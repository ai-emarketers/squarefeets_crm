// Two endpoints the web app is built around: GET /api/bootstrap (load everything) and POST /api/sync (save diffs).
import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { StateService } from './state.service';

/** The web app loads everything once (`bootstrap`) and pushes diffs (`sync`). Authorisation is enforced per collection. */
@Controller()
export class StateController {
  constructor(private state: StateService) {}
  // Full snapshot the UI needs on start-up: profile, all collections, org settings, perms, masters, team, files.
  @Get('bootstrap') bootstrap(@CurrentUser() u: AuthUser) { return this.state.bootstrap(u); }
  // Receives only what changed since the last save; replies with any rejected operations.
  @Post('sync') sync(@CurrentUser() u: AuthUser, @Body() b: any) { return this.state.apply(u, b || {}); }
}
