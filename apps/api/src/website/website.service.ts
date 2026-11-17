// WebsiteService — pushes CRM projects and standalone properties to the WordPress website and takes them down again.
//
// Configuration (Railway variables on the api service):
//   WP_URL           e.g. https://squarefeetsrealty.com           (site address)
//   WP_REST_URL      optional; REST base. Default: WP_URL + /index.php/wp-json  (this site uses index.php permalinks)
//   WP_USER          WordPress user the CRM acts as (needs edit_others_posts and upload_files, e.g. the Manager role)
//   WP_APP_PASSWORD  an Application Password created for that user (Users > Profile > Application Passwords)
// Needs the sf-crm-sync plugin (wordpress/sf-crm-sync) active on the website. Without the variables every call answers 503.
import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';
import { uploadRoot } from '../files/files.util';
import { ListingPayload, mapProject, mapProperty, MapContext, WebContent } from './listing.mapper';

export type Kind = 'project' | 'property';

@Injectable()
export class WebsiteService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** True when the WordPress address and credentials are set (the web app hides the switch when they are not). */
  configured() { return !!(process.env.WP_URL || process.env.WP_REST_URL) && !!process.env.WP_USER && !!process.env.WP_APP_PASSWORD; }

  private base() {
    const rest = process.env.WP_REST_URL || (process.env.WP_URL || '').replace(/\/$/, '') + '/index.php/wp-json';
    return rest.replace(/\/$/, '');
  }
  private auth() { return 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64'); }

  /** One call to WordPress. Turns network problems and WordPress error messages into readable 502 errors. */
  private async wp(route: string, init: { method?: string; headers?: Record<string, string>; body?: any } = {}): Promise<any> {
    if (!this.configured()) throw new ServiceUnavailableException('The website connection is not set up yet. Ask the admin to add the WordPress settings.');
    let res: Response;
    try {
      res = await fetch(this.base() + route, { method: init.method || 'GET', headers: { authorization: this.auth(), ...(init.headers || {}) }, body: init.body, signal: AbortSignal.timeout(60_000) });
    } catch (e: any) {
      throw new BadGatewayException('Could not reach the website: ' + (e?.message || 'network error'));
    }
    const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok) throw new BadGatewayException('The website refused the request (' + res.status + '): ' + (json?.message || text.slice(0, 200)));
    return json;
  }

  /** Uploads one stored CRM file to the WordPress media library and returns the media id. */
  private async uploadMedia(file: { id: string; name: string; mime: string; path: string }): Promise<number> {
    const abs = path.resolve(uploadRoot(), file.path);
    if (!abs.startsWith(uploadRoot())) throw new BadRequestException('Bad file path');
    let buf: Buffer;
    try { buf = await fs.readFile(abs); } catch { throw new BadRequestException(`The file "${file.name}" is missing on the server. Upload it again.`); }
    const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const out = await this.wp('/wp/v2/media', { method: 'POST', headers: { 'content-type': file.mime || 'application/octet-stream', 'content-disposition': `attachment; filename="${name}"` }, body: buf });
    return Number(out.id);
  }

  /** Link row for a record (or an empty one). */
  async status(kind: Kind, id: string) {
    const l = await this.prisma.websiteLink.findUnique({ where: { ref: `${kind}:${id}` } });
    return { configured: this.configured(), published: !!l?.published, postId: l?.postId || 0, url: l?.url || '', syncedAt: l?.syncedAt || null, syncedBy: l?.syncedBy || '' };
  }

  /** Builds the listing from the CRM record and pushes it live. Creates the website page the first time, updates it afterwards. */
  async publish(kind: Kind, id: string, user: AuthUser) {
    if (!this.configured()) throw new ServiceUnavailableException('The website connection is not set up yet. Ask the admin to add the WordPress settings.');
    const ref = `${kind}:${id}`;
    const record: any = kind === 'project' ? await this.prisma.project.findUnique({ where: { id } }) : await this.prisma.property.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`${kind === 'project' ? 'Project' : 'Property'} ${id} not found.`);
    if (kind === 'property') {
      if (record.projectId) throw new BadRequestException('This property belongs to a project. Publish the project instead; its units appear on the project page.');
      if (record.status === 'Draft') throw new BadRequestException('Save the property as a listing first (drafts cannot be published).');
    }
    const link = await this.prisma.websiteLink.findUnique({ where: { ref } });
    const media: Record<string, number> = { ...((link?.media as any) || {}) };
    const files = await this.prisma.fileRecord.findMany({ where: { scope: `${kind === 'project' ? 'proj' : 'prop'}:${id}` }, orderBy: { createdAt: 'asc' } });
    const up = async (f: any) => (media[f.id] ||= await this.uploadMedia(f));
    const photos: number[] = [];
    for (const f of files.filter((x) => /^photos?$/i.test(x.cat) && x.mime.startsWith('image/') && x.path)) photos.push(await up(f));
    const bro = files.find((x) => /brochure/i.test(x.cat) && x.mime === 'application/pdf' && x.path);
    const brochureId = bro ? await up(bro) : undefined;
    const amenityMaster = await this.prisma.amenity.findMany();
    const units = kind === 'project' ? await this.prisma.property.findMany({ where: { projectId: id } }) : [];
    const ctx: MapContext = {
      web: (((record.data as any) || {}).web || {}) as WebContent, postId: link?.postId || undefined, publish: true,
      amenityMaster: amenityMaster.map((a: any) => ({ id: a.id, label: a.label })), photos, floorPlanMedia: {}, brochureId, units,
    };
    const payload: ListingPayload = kind === 'project' ? mapProject(record, ctx) : mapProperty(record, ctx);
    if (!payload.title) throw new BadRequestException('Give it a name or title before publishing.');
    const out = await this.wp('/sf-crm/v1/listing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const row = await this.prisma.websiteLink.upsert({
      where: { ref },
      create: { ref, postId: out.postId, url: out.url || '', published: true, media: media as any, syncedAt: new Date(), syncedBy: user.name },
      update: { postId: out.postId, url: out.url || '', published: true, media: media as any, syncedAt: new Date(), syncedBy: user.name },
    });
    await this.audit.log(user.name, 'website.publish', ref, { postId: row.postId });
    return { published: true, postId: row.postId, url: row.url };
  }

  /** Takes the listing off the website (it becomes a draft there; nothing is deleted). */
  async unpublish(kind: Kind, id: string, user: AuthUser) {
    const ref = `${kind}:${id}`;
    const link = await this.prisma.websiteLink.findUnique({ where: { ref } });
    if (!link || !link.postId) throw new BadRequestException('This was never published to the website.');
    await this.wp('/sf-crm/v1/listing/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: link.postId, status: 'draft' }) });
    await this.prisma.websiteLink.update({ where: { ref }, data: { published: false, syncedAt: new Date(), syncedBy: user.name } });
    await this.audit.log(user.name, 'website.unpublish', ref, { postId: link.postId });
    return { published: false, postId: link.postId, url: link.url };
  }
}
