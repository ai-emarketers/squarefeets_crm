// Team endpoints (all under /api/team, need the Team module permission: read for GET, write for the rest):
//   GET    /team                  list members (no sensitive fields)
//   POST   /team                  add a member
//   PATCH  /team/:name            edit a member (only the fields you send)
//   POST   /team/:name/status     { status: 'Active' | 'Disabled' }  activate / deactivate
//   DELETE /team/:name            remove a member
//   POST   /team/:name/password   { password, email? }  set or reset a sign-in password (Owner/Admin only)
// The rules (owner protection, no self-lockout, unique email …) are in TeamService.
import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, Perm } from '../auth/auth.decorators';
import { MemberUpdateDto, SetPasswordDto, StatusDto, TeamMemberDto } from './team.dto';
import { TeamService } from './team.service';

@Controller('team')
@Perm('team')
export class TeamController {
  constructor(private team: TeamService) {}

  @Get() list() { return this.team.list(); }

  @Post() async create(@Body() b: TeamMemberDto, @CurrentUser() me: AuthUser) {
    const u = await this.team.save(me, b, 'create');
    return { id: u.id, name: u.name, role: u.role, email: u.email, status: u.status };
  }

  @Patch(':name') async update(@Param('name') name: string, @Body() b: MemberUpdateDto, @CurrentUser() me: AuthUser) {
    const u = await this.team.save(me, { ...b, name }, 'update');
    return { id: u.id, name: u.name, role: u.role, email: u.email, status: u.status };
  }

  @Post(':name/status') async status(@Param('name') name: string, @Body() b: StatusDto, @CurrentUser() me: AuthUser) {
    const u = await this.team.save(me, { name, status: b.status }, 'update');
    return { name: u.name, status: u.status };
  }

  @Delete(':name') async remove(@Param('name') name: string, @CurrentUser() me: AuthUser) {
    if (!(await this.team.remove(me, name))) throw new NotFoundException('Team member not found.');
    return { ok: true };
  }

  @Post(':name/password') setPassword(@Param('name') name: string, @Body() b: SetPasswordDto, @CurrentUser() me: AuthUser) {
    return this.team.setPassword(me, name, b.password, b.email);
  }
}
