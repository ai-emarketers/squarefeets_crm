// Registers the file upload/download controller.
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';

// FilesModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [FilesController] })
export class FilesModule {}
