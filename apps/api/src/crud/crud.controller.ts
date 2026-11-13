// Base REST controller shared by every "document" module (projects, leads, prospects, visits, ...).
import { Body, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { CrudService } from './crud.service';

/** Base controller: concrete controllers add @Controller('path') and @Perm('module'). */
export abstract class CrudController {
  // The concrete controller passes in its own service (e.g. LeadsService).
  constructor(protected readonly svc: CrudService) {}
  // GET /<path>        -> all records (phones/emails masked when the user may not see them)
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  // GET /<path>/:id    -> one record
  @Get(':id') get(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.get(id, u); }
  // POST /<path>       -> create a record
  @Post() create(@Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.create(b, u); }
  // PATCH /<path>/:id  -> partial update
  @Patch(':id') update(@Param('id') id: string, @Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.update(id, b, u); }
  // DELETE /<path>/:id -> delete
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.remove(id, u); }
}
