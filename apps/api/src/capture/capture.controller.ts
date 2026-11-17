// Screenshot capture endpoints:
//   GET  /api/capture/status       is the OpenRouter key set up?
//   POST /api/capture/screenshot   multipart field "file" (PNG/JPG/WebP, up to 8 MB) -> leads found in the chat
// Needs write access to the Leads module (checked by PermGuard from the HTTP verb).
import { Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Perm } from '../auth/auth.decorators';
import { CaptureService } from './capture.service';

@Controller('capture')
@Perm('leads')
export class CaptureController {
  constructor(private svc: CaptureService) {}
  @Get('status') status() { return { configured: this.svc.configured() }; }
  @Post('screenshot')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  screenshot(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) { return this.svc.fromScreenshot(file, u); }
}
