// One place that talks to OpenRouter, used by screenshot capture and brochure reading.
// Requests ask OpenRouter to use only providers that do not store or train on prompts (data_collection: deny).
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } } | { type: 'file'; file: { filename: string; file_data: string } };

/** Sends one user message with the given parts and returns the model's text and the cost in US dollars (null when not reported). */
export async function askOpenRouter(model: string, content: ContentPart[], opts: { maxTokens?: number; timeoutMs?: number; plugins?: unknown[] } = {}): Promise<{ text: string; cost: number | null }> {
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY, 'content-type': 'application/json', 'x-title': 'Squarefeets CRM' },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: opts.maxTokens || 2000, response_format: { type: 'json_object' }, provider: { data_collection: 'deny' },
        ...(opts.plugins ? { plugins: opts.plugins } : {}),
        messages: [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs || 90_000),
    });
  } catch (e: any) { throw new BadGatewayException('Could not reach the AI service: ' + (e?.message || 'network error')); }
  const j: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.error?.message || res.statusText;
    if (res.status === 401) throw new ServiceUnavailableException('The OpenRouter key was refused. Ask the admin to check it.');
    if (res.status === 402) throw new ServiceUnavailableException('The OpenRouter account is out of credit. Ask the admin to add some.');
    throw new BadGatewayException('The AI service refused the request (' + res.status + '): ' + msg);
  }
  const t = j?.choices?.[0]?.message?.content;
  return { text: Array.isArray(t) ? t.map((p: any) => p?.text || '').join('') : String(t || ''), cost: typeof j?.usage?.cost === 'number' ? j.usage.cost : null };
}
