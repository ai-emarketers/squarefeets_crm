// Document upload / download endpoints: POST /api/files/upload and GET /api/files/:id/content.
import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { PermissionsService } from '../auth/permissions.service';
import { uploadRoot } from './files.util';

// Allowed upload extensions (documents, images, spreadsheets) — anything else is rejected.
const OK_TYPE = /\.(pdf|jpe?g|png|webp|heic|docx?|xlsx?|csv|txt)$/i;

/** Which permission module governs documents of each scope type (prop:RS001, deal:DEAL-0142 …). */
const SCOPE_MODULE: Record<string, string> = { prop: 'properties', proj: 'projects', pros: 'prospects', lead: 'leads', deal: 'deals', brok: 'brokerage', visit: 'visits', req: 'requirements' };

// Document upload/download endpoints under /api/files.
@Controller('files')
export class FilesController {
  // Prisma stores the file metadata; PermissionsService checks module access for the file's scope.
  constructor(private prisma: PrismaService, private perms: PermissionsService) {}

  // Throws 403 unless the user has read/write access to the module that owns this scope (prop, deal, lead...).
  private async check(user: AuthUser, scope: string, need: 'read' | 'write') {
    const mod = SCOPE_MODULE[String(scope).split(':')[0]];
    if (!mod) return;                           // unknown scope (e.g. drafts) — any signed-in user
    const lvl = await this.perms.level(user, mod);
    if (lvl === 'none' || (need === 'write' && lvl !== 'write')) throw new ForbiddenException(`No ${need} access to ${mod}`);
  }

  /** Stores the binary for a document record created in the UI. The metadata row is created/updated through /sync. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() b: { id: string; scope: string; cat?: string }, @CurrentUser() u: AuthUser) {
    // --- validate the request ---
    if (!file) throw new BadRequestException('No file');
    if (!b.id || !b.scope) throw new BadRequestException('id and scope are required');
    await this.check(u, b.scope, 'write');
    if (!OK_TYPE.test(file.originalname)) throw new BadRequestException('File type not supported');
    // --- build a safe storage path: <scope>/<id>-<filename>, with unsafe characters replaced ---
    const safeScope = b.scope.replace(/[^a-zA-Z0-9:_-]/g, '_').replace(':', '/');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const rel = path.join(safeScope, `${b.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${safeName}`);
    const abs = path.resolve(uploadRoot(), rel);
    // path-traversal guard: the final path must stay inside the upload folder
    if (!abs.startsWith(uploadRoot())) throw new BadRequestException('Bad path');
    // --- write the bytes to disk and record/refresh the metadata row ---
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.buffer);
    await this.prisma.fileRecord.upsert({
      where: { id: b.id },
      create: { id: b.id, scope: b.scope, name: file.originalname, cat: b.cat || 'Other', size: file.size, mime: file.mimetype, path: rel },
      update: { path: rel, size: file.size, mime: file.mimetype },
    });
    return { id: b.id, hasBlob: true };
  }

  /** Streams a stored file back (inline) after checking the user may read that scope. Opened by the web app via an authenticated fetch. */
  @Get(':id/content')
  async content(@Param('id') id: string, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const row = await this.prisma.fileRecord.findUnique({ where: { id } });
    if (!row || !row.path) throw new NotFoundException();
    await this.check(u, row.scope, 'read');
    const abs = path.resolve(uploadRoot(), row.path);
    if (!abs.startsWith(uploadRoot())) throw new NotFoundException(); // traversal guard
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.name)}"`);
    res.sendFile(abs);
  }
}
