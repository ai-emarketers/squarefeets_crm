// Endpoints: POST /api/share/matches (signed in) sends the matched-properties PDF + documents by email, or prepares the WhatsApp message with links.
//            GET  /api/share/f/:token (public) downloads the PDF or one document behind such a link. The token is the only credential.
import { Body, Controller, Get, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Act, AuthUser, CurrentUser, Perm, Public } from '../auth/auth.decorators';
import { ShareMatchesDto } from './share.dto';
import { ShareService } from './share.service';
import { verifyToken } from './share.token';

// Public downloads per address: a small in-memory limit (120 per 10 minutes) against scraping. (Links are unguessable signed tokens, so this is only a second layer.)
const hits = new Map<string, { n: number; t: number }>();
const limited = (ip: string) => { const now = Date.now(), h = hits.get(ip); if (!h || now - h.t > 600000) { hits.set(ip, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false; } h.n++; return h.n > 120; };
const ctype = (m: string) => (/^(application\/pdf|image\/(jpeg|png|webp)|text\/plain|text\/csv)$/i.test(m) ? m : 'application/octet-stream');

@Controller('share')
export class ShareController {
  constructor(private svc: ShareService) {}

  // Needs write access to requirements (the Matches screen) and permission to see contact details, like the email endpoint.
  @Post('matches') @Perm('requirements') @Act('seeNumbers')
  matches(@Body() b: ShareMatchesDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.svc.send(u, b, req); }

  // Anyone holding the link may download. Every failure is the same plain 404, so nothing is revealed about why.
  @Public() @Get('f/:token')
  async file(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    if (limited(String(req.headers['x-forwarded-for'] || req.ip || 'x').split(',')[0].trim())) { res.status(429).send('Too many requests'); return; }
    const p = verifyToken(token); const r = p ? await this.svc.resolve(p).catch(() => null) : null;
    if (!r) throw new NotFoundException();
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(r.name)}`);
    if (r.kind === 'pdf') { res.setHeader('Content-Type', 'application/pdf'); res.end(r.buf); return; }
    res.setHeader('Content-Type', ctype(r.mime)); res.sendFile(r.abs);
  }
}
