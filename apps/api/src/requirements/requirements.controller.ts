// Endpoints: /api/requirements (CRUD) and /api/matches/* (smart matching results).
import { Controller, Get, Param } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { RequirementsService } from './requirements.service';

// REST endpoints under /api/requirements.
@Controller('requirements')
@Perm('requirements')
export class RequirementsController extends CrudController {
  constructor(private readonly reqs: RequirementsService) { super(reqs); }
}

/** Matches screen: pending requirements + the properties that fit each one. */
@Controller('matches')
@Perm('requirements')
export class MatchesController {
  constructor(private readonly reqs: RequirementsService) {}
  // GET /api/matches/pending -> all active requirements (prospects + leads with a budget)
  @Get('pending') pending() { return this.reqs.pending(); }
  // GET /api/matches/:id     -> scored property matches for one requirement (or LEAD-<id>)
  @Get(':id') matches(@Param('id') id: string) { return this.reqs.matches(id); }
}
