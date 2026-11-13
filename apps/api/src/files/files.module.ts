// Registers the file upload/download controller.
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';

@Module({ controllers: [FilesController] })
export class FilesModule {}
