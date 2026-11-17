// POST /api/capture/brochure — read a project brochure PDF and return project-form fields.
//   multipart field "file" (PDF, up to 10 MB), or form field "fileId" naming a brochure already saved on a project.
// Needs write access to the Projects module (checked by PermGuard from the HTTP verb).
import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Perm } from '../auth/auth.decorators';
import { BrochureService } from './brochure.service';

@Controller('capture')
@Perm('projects')
export class BrochureController {
  constructor(private svc: BrochureService) {}
  @Post('brochure')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  brochure(@UploadedFile() file: Express.Multer.File | undefined, @Body() b: { fileId?: string }, @CurrentUser() u: AuthUser) { return this.svc.fromPdf(file, b?.fileId, u); }
}
