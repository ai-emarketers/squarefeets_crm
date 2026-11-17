// Capture module: reads WhatsApp screenshots into leads and project brochures into project fields, with models on OpenRouter.
import { Module } from '@nestjs/common';
import { BrochureController } from './brochure.controller';
import { BrochureService } from './brochure.service';
import { CaptureController } from './capture.controller';
import { CaptureService } from './capture.service';

@Module({ controllers: [CaptureController, BrochureController], providers: [CaptureService, BrochureService] })
export class CaptureModule {}
