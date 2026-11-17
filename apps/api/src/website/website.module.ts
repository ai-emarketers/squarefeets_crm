// Website module: publishes CRM projects and properties to the WordPress website.
import { Module } from '@nestjs/common';
import { WebsiteController, WebsiteProjectsController, WebsitePropertiesController } from './website.controller';
import { WebsiteService } from './website.service';

@Module({ controllers: [WebsiteController, WebsiteProjectsController, WebsitePropertiesController], providers: [WebsiteService] })
export class WebsiteModule {}
