import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser, CurrentUser, Perm } from '../auth/auth.decorators';

// Team endpoints: GET /api/team (names/roles) and POST /api/team/:name/password.
@Controller('team')
@Perm('team')
export class TeamController {
  constructor(private prisma: PrismaService, private perms: PermissionsService) {}

  // List team members without any sensitive fields.
  @Get() async list() {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((u) => ({ id: u.id, name: u.name, role: u.role, email: u.email, status: u.status }));
  }

  /** Owner/admin sets (or resets) a team member's sign-in password. Team members are created from Settings → Team. */
  @Post(':name/password')
  async setPassword(@Param('name') name: string, @Body() b: { password: string; email?: string }, @CurrentUser() me: AuthUser) {
    // only Owner/Admin may set passwords; the Owner's password can only be set by the Owner
    if (me.role !== 'Owner' && me.role !== 'Admin') throw new ForbiddenException('Only the owner or an admin can set passwords.');
    if (!b.password || b.password.length < 8) throw new ForbiddenException('Password must be at least 8 characters.');
    // look the member up by name (names are unique)
    const u = await this.prisma.user.findUnique({ where: { name } });
    if (!u) throw new NotFoundException();
    if (u.role === 'Owner' && me.role !== 'Owner') throw new ForbiddenException();
    // store the bcrypt hash (never the plain password), activate the account and optionally set the sign-in email
    await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.password, 10), status: 'Active', ...(b.email ? { email: b.email.toLowerCase() } : {}) } });
    return { ok: true };
  }
}
