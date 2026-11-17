// BrochureService — reads a project brochure (PDF) with a model on OpenRouter and returns project-form fields for review.
//
// Railway variables (api service, on top of OPENROUTER_API_KEY from screenshot capture):
//   OPENROUTER_BROCHURE_MODEL            default google/gemini-2.5-flash (the model the website's own brochure reader already uses)
//   OPENROUTER_BROCHURE_FALLBACK_MODEL   default anthropic/claude-sonnet-5.5; "off" disables it. Used only when the first answer is unreadable, unsure or empty
//   OPENROUTER_PDF_ENGINE                optional: native | mistral-ocr | pdf-text (how OpenRouter reads the PDF; empty = OpenRouter's choice)
//   BROCHURE_PER_USER_DAILY              default 30 brochures per person per day
// The PDF is either uploaded with the request or, for a brochure already saved on the project, named by its document id.
import { BadGatewayException, BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';
import { uploadRoot } from '../files/files.util';
import { askOpenRouter } from './openrouter';
import { BROCHURE_PROMPT, BrochureFields, brochureNeedsFallback, normalizeBrochure, parseBrochureJson } from './brochure.parse';

export interface BrochureResponse { fields: BrochureFields; warnings: string[]; confidence: number; locality: string; model: string; usedFallback: boolean; costUsd: number | null }

@Injectable()
export class BrochureService {
  private count = new Map<string, number>(); // brochures per user per day (resets when the API restarts; a safety net)
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  configured() { return !!process.env.OPENROUTER_API_KEY; }
  private primary() { return process.env.OPENROUTER_BROCHURE_MODEL || 'google/gemini-2.5-flash'; }
  private fallback() { const f = process.env.OPENROUTER_BROCHURE_FALLBACK_MODEL ?? 'anthropic/claude-sonnet-5.5'; return !f || f.toLowerCase() === 'off' ? '' : f; }

  private async ask(model: string, filename: string, pdf: Buffer) {
    const engine = process.env.OPENROUTER_PDF_ENGINE;
    const r = await askOpenRouter(model, [{ type: 'text', text: BROCHURE_PROMPT }, { type: 'file', file: { filename, file_data: 'data:application/pdf;base64,' + pdf.toString('base64') } }],
      { maxTokens: 6000, timeoutMs: 170_000, plugins: engine ? [{ id: 'file-parser', pdf: { engine } }] : undefined });
    return { raw: parseBrochureJson(r.text), cost: r.cost };
  }

  /** Loads the PDF of a brochure already saved as a project document (the user needs write access to projects, checked by the caller). */
  private async saved(fileId: string): Promise<{ name: string; buffer: Buffer }> {
    const rec = await this.prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!rec || !rec.path) throw new NotFoundException('That brochure file was not found. Upload it again.');
    if (!rec.scope.startsWith('proj:')) throw new ForbiddenException('Only project brochures can be read here.');
    if (rec.mime !== 'application/pdf' && !/\.pdf$/i.test(rec.name)) throw new BadRequestException('Only PDF brochures can be read.');
    const abs = path.resolve(uploadRoot(), rec.path);
    if (!abs.startsWith(uploadRoot())) throw new BadRequestException('Bad file path');
    try { return { name: rec.name, buffer: await fs.readFile(abs) }; } catch { throw new NotFoundException('The brochure file is missing on the server. Upload it again.'); }
  }

  async fromPdf(file: { buffer: Buffer; mimetype: string; originalname: string } | undefined, fileId: string | undefined, user: AuthUser): Promise<BrochureResponse> {
    if (!this.configured()) throw new ServiceUnavailableException('Brochure reading is not set up yet. Ask the admin to add the OpenRouter key.');
    let name = 'brochure.pdf'; let buffer: Buffer;
    if (file) {
      if (file.mimetype !== 'application/pdf') throw new BadRequestException('The brochure must be a PDF.');
      name = file.originalname || name; buffer = file.buffer;
    } else if (fileId) { const s = await this.saved(String(fileId)); name = s.name; buffer = s.buffer; }
    else throw new BadRequestException('Choose a PDF brochure first.');
    const key = user.id + ':' + new Date().toISOString().slice(0, 10); const limit = Number(process.env.BROCHURE_PER_USER_DAILY) || 30;
    if ((this.count.get(key) || 0) >= limit) throw new HttpException('Daily brochure limit reached for your account.', HttpStatus.TOO_MANY_REQUESTS);
    this.count.set(key, (this.count.get(key) || 0) + 1);

    const master = (await this.prisma.amenity.findMany()).map((a: any) => ({ id: a.id, label: a.label }));
    let model = this.primary(); let used = false;
    let { raw, cost } = await this.ask(model, name, buffer);
    let res = raw ? normalizeBrochure(raw, master) : undefined;
    if (brochureNeedsFallback(raw, res) && this.fallback()) {
      const second = await this.ask(this.fallback(), name, buffer);
      cost = (cost ?? 0) + (second.cost ?? 0);
      if (second.raw) { raw = second.raw; res = normalizeBrochure(raw, master); model = this.fallback(); used = true; }
    }
    if (!raw || !res) throw new BadGatewayException('The AI could not read that brochure. Try a smaller or clearer PDF, or fill the form by hand.');
    await this.audit.log(user.name, 'capture.brochure', model, { fields: Object.keys(res.fields).length, fallback: used }); // never the brochure text
    return { ...res, model, usedFallback: used, costUsd: cost };
  }
}
