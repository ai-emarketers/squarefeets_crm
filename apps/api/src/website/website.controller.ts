// Website endpoints:
//   GET  /api/website/status                         is the WordPress connection set up?
//   GET  /api/website/projects/:id | /properties/:id  link status (published, public address, last push)
//   POST /api/website/projects/:id/publish | /unpublish     (same for /properties/:id)
// Reading needs read access to the module, publishing/unpublishing needs write access (checked by PermGuard from the HTTP verb).
import { Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, Perm } from '../auth/auth.decorators';
import { WebsiteService } from './website.service';

@Controller('website')
export class WebsiteController {
  constructor(private svc: WebsiteService) {}
  @Get('status') @Perm('projects') status() { return { configured: this.svc.configured() }; }
}

@Controller('website/projects')
@Perm('projects')
export class WebsiteProjectsController {
  constructor(private svc: WebsiteService) {}
  @Get(':id') get(@Param('id') id: string) { return this.svc.status('project', id); }
  @Post(':id/publish') publish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.publish('project', id, u); }
  @Post(':id/unpublish') unpublish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.unpublish('project', id, u); }
}

@Controller('website/properties')
@Perm('properties')
export class WebsitePropertiesController {
  constructor(private svc: WebsiteService) {}
  @Get(':id') get(@Param('id') id: string) { return this.svc.status('property', id); }
  @Post(':id/publish') publish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.publish('property', id, u); }
  @Post(':id/unpublish') unpublish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.unpublish('property', id, u); }
}
