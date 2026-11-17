// Compares OpenRouter models on real screenshots, so the model for screenshot capture is chosen on evidence.
//
// 1. Put screenshots in a folder, e.g. samples/1.png, 2.png ...
// 2. Next to each, write the expected answer as JSON with the same name: samples/1.expected.json
//      { "contactName": "Sanjeev Shroff", "items": [ { "intent": "rent", "kind": "Commercial", "area": "673", "max": "" }, ... ] }
//    Only the fields you list are checked. Items are compared in order.
// 3. Run (needs OPENROUTER_API_KEY; each call costs a fraction of a cent):
//      OPENROUTER_API_KEY=... npm run capture:eval -- ./samples anthropic/claude-haiku-5.5,google/gemini-2.5-flash-lite,openai/gpt-4.1-nano
// It prints, per model: fields correct out of fields checked, screenshots that could not be read, total cost and average seconds.
// Screenshots contain real phone numbers: keep the folder out of git (it is not committed by default).
import { promises as fs } from 'fs';
import * as path from 'path';
import { extractJson, normalizeCapture, PROMPT } from '../src/capture/capture.parse';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function ask(model: string, dataUrl: string) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 2000, response_format: { type: 'json_object' }, provider: { data_collection: 'deny' }, messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }] }),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) return { raw: null, cost: 0, secs: (Date.now() - t0) / 1000, error: j?.error?.message || res.statusText };
  return { raw: extractJson(String(j?.choices?.[0]?.message?.content || '')), cost: Number(j?.usage?.cost) || 0, secs: (Date.now() - t0) / 1000, error: '' };
}

async function main() {
  const [dir, list] = process.argv.slice(2);
  if (!process.env.OPENROUTER_API_KEY || !dir || !list) { console.log('Usage: OPENROUTER_API_KEY=... npm run capture:eval -- <folder> <model1,model2,...>'); process.exit(1); }
  const files = (await fs.readdir(dir)).filter((f) => MIME[path.extname(f).toLowerCase()]).sort();
  for (const model of list.split(',')) {
    let ok = 0, total = 0, unreadable = 0, cost = 0, secs = 0;
    for (const f of files) {
      const base = f.replace(/\.[^.]+$/, ''); let exp: any;
      try { exp = JSON.parse(await fs.readFile(path.join(dir, base + '.expected.json'), 'utf8')); } catch { continue; }
      const buf = await fs.readFile(path.join(dir, f));
      const r = await ask(model, `data:${MIME[path.extname(f).toLowerCase()]};base64,${buf.toString('base64')}`);
      cost += r.cost; secs += r.secs;
      if (!r.raw) { unreadable++; total += 1 + (exp.items || []).reduce((n: number, i: any) => n + Object.keys(i).length, 0); console.log(`  ${model} ${f}: unreadable ${r.error}`); continue; }
      const got = normalizeCapture(r.raw);
      if (exp.contactName !== undefined) { total++; if (got.contactName.toLowerCase().startsWith(String(exp.contactName).toLowerCase())) ok++; }
      (exp.items || []).forEach((e: any, i: number) => Object.keys(e).forEach((k) => { total++; if (String((got.items[i] as any)?.[k] ?? '') === String(e[k])) ok++; else console.log(`  ${model} ${f} item ${i + 1} ${k}: expected "${e[k]}", got "${(got.items[i] as any)?.[k] ?? ''}"`); }));
      if (got.items.length !== (exp.items || []).length) console.log(`  ${model} ${f}: expected ${(exp.items || []).length} items, got ${got.items.length}`);
    }
    console.log(`${model}: ${ok}/${total} fields correct, ${unreadable} unreadable, $${cost.toFixed(4)} total, ${(secs / Math.max(1, files.length)).toFixed(1)}s each`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
