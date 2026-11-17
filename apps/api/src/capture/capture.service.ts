// CaptureService — reads a WhatsApp screenshot with a vision model on OpenRouter and returns leads for the AI capture preview.
//
// Railway variables (api service):
//   OPENROUTER_API_KEY          required
//   OPENROUTER_MODEL            default anthropic/claude-haiku-5.5 (cheap first pass, about $0.10 / $0.50 per million tokens in/out)
//   OPENROUTER_FALLBACK_MODEL   default anthropic/claude-sonnet-5.5, used only when the first answer is unreadable or unsure. "off" disables it
//   CAPTURE_PER_USER_DAILY      default 100 screenshots per person per day
// Requests ask OpenRouter not to use providers that store or train on prompts (data_collection: deny), because chats hold phone numbers.
import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';
import { CaptureItem, CaptureResult, extractJson, needsFallback, normalizeCapture, PROMPT, RawCapture } from './capture.parse';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export interface Duplicate { kind: 'lead' | 'prospect'; id: string; name: string; by: 'phone' | 'name' }
export interface CaptureResponse extends CaptureResult { duplicates: Duplicate[]; model: string; usedFallback: boolean; costUsd: number | null }

@Injectable()
export class CaptureService {
  private count = new Map<string, number>(); // screenshots per user per day (resets when the API restarts; a safety net)
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  configured() { return !!process.env.OPENROUTER_API_KEY; }
  private primary() { return process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5'; }
  private fallback() { const f = process.env.OPENROUTER_FALLBACK_MODEL ?? 'anthropic/claude-sonnet-5.5'; return !f || f.toLowerCase() === 'off' ? '' : f; }

  /** One vision call. Returns the parsed JSON (or null when unreadable) and what it cost. */
  private async ask(model: string, dataUrl: string): Promise<{ raw: RawCapture | null; cost: number | null }> {
    let res: Response;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY, 'content-type': 'application/json', 'x-title': 'Squarefeets CRM' },
        body: JSON.stringify({
          model, temperature: 0, max_tokens: 2000, response_format: { type: 'json_object' }, provider: { data_collection: 'deny' },
          messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e: any) { throw new BadGatewayException('Could not reach the AI service: ' + (e?.message || 'network error')); }
    const j: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = j?.error?.message || res.statusText;
      if (res.status === 401) throw new ServiceUnavailableException('The OpenRouter key was refused. Ask the admin to check it.');
      if (res.status === 402) throw new ServiceUnavailableException('The OpenRouter account is out of credit. Ask the admin to add some.');
      throw new BadGatewayException('The AI service refused the request (' + res.status + '): ' + msg);
    }
    const text = j?.choices?.[0]?.message?.content;
    return { raw: extractJson(Array.isArray(text) ? text.map((p: any) => p?.text || '').join('') : String(text || '')), cost: typeof j?.usage?.cost === 'number' ? j.usage.cost : null };
  }

  /** Existing leads or prospects that look like the same person: same phone number, or the same (possibly cut-off) name. */
  async duplicates(name: string, phone: string): Promise<Duplicate[]> {
    const out: Duplicate[] = [];
    const n = name.toLowerCase().replace(/(\.\.\.|…)$/, '').replace(/\s+/g, ' ').trim();
    const rows: { kind: 'lead' | 'prospect'; id: string; name: string; phone: string }[] = [
      ...(await this.prisma.lead.findMany({ select: { id: true, name: true, phone: true } })).map((r) => ({ kind: 'lead' as const, ...r })),
      ...(await this.prisma.prospect.findMany({ select: { id: true, name: true, phone: true } })).map((r) => ({ kind: 'prospect' as const, ...r })),
    ];
    for (const r of rows) {
      const rn = r.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (phone && r.phone.replace(/\D/g, '').slice(-10) === phone) out.push({ kind: r.kind, id: r.id, name: r.name, by: 'phone' });
      else if (n.length >= 5 && rn && (rn === n || rn.startsWith(n) || n.startsWith(rn))) out.push({ kind: r.kind, id: r.id, name: r.name, by: 'name' });
      if (out.length >= 5) break;
    }
    return out;
  }

  /** Reads a screenshot. A cheap model goes first; a stronger one is used only when the first answer is unreadable or unsure. */
  async fromScreenshot(file: { buffer: Buffer; mimetype: string; size: number }, user: AuthUser): Promise<CaptureResponse> {
    if (!this.configured()) throw new ServiceUnavailableException('Screenshot reading is not set up yet. Ask the admin to add the OpenRouter key.');
    if (!file) throw new BadRequestException('Choose a screenshot first.');
    if (!IMAGE_TYPES.includes(file.mimetype)) throw new BadRequestException('Use a PNG, JPG or WebP screenshot (HEIC photos are not supported).');
    const key = user.id + ':' + new Date().toISOString().slice(0, 10); const limit = Number(process.env.CAPTURE_PER_USER_DAILY) || 100;
    if ((this.count.get(key) || 0) >= limit) throw new HttpException('Daily screenshot limit reached for your account.', HttpStatus.TOO_MANY_REQUESTS);
    this.count.set(key, (this.count.get(key) || 0) + 1);

    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    let model = this.primary(); let used = false;
    let { raw, cost } = await this.ask(model, dataUrl);
    if (needsFallback(raw) && this.fallback()) {
      const second = await this.ask(this.fallback(), dataUrl);
      if (second.raw) { raw = second.raw; model = this.fallback(); used = true; }
      cost = (cost ?? 0) + (second.cost ?? 0);
    }
    if (!raw) throw new BadGatewayException('The AI could not read that screenshot. Try a clearer one, or type the details.');
    const result = normalizeCapture(raw);
    const duplicates = await this.duplicates(result.contactName, result.phone);
    await this.audit.log(user.name, 'capture.screenshot', model, { items: result.items.length, fallback: used }); // never the chat content
    return { ...result, duplicates, model, usedFallback: used, costUsd: cost };
  }
}

export type { CaptureItem };
