// Login, profile and password change logic.
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import { AuditService } from '../audit/audit.service';

// Sign-in logic: password check, token issue, password change.
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private perms: PermissionsService, private audit: AuditService) {}

  // Check email + password, then issue a JWT. The same generic error is used for every failure (no user enumeration).
  async login(email: string, password: string) {
    const u = await this.prisma.user.findUnique({ where: { email: String(email || '').toLowerCase().trim() } });
    if (!u || !u.passwordHash || ['Disabled', 'Inactive'].includes(u.status) || !(await bcrypt.compare(password || '', u.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    // remember when they last signed in (shown on the Team screen); a failure here must not block the sign-in
    await this.prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
    return { token: await this.jwt.signAsync({ sub: u.id }), user: await this.profile(u.id) };
  }

  // The signed-in user's identity PLUS what they may do: access level per module and per action.
  // The web app uses this to show/hide menus and buttons.
  async profile(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new UnauthorizedException();
    const au = { id: u.id, name: u.name, role: u.role, email: u.email, seeNumbers: u.seeNumbers };
    const p = await this.perms.perms();
    const mods = (p.mods || []).map((m: any) => m[0]);
    const levels: Record<string, string> = {};
    for (const m of mods) levels[m] = await this.perms.level(au, m);        // none | read | write
    const actions: Record<string, boolean> = {};
    for (const a of p.act || []) actions[a[0]] = await this.perms.can(au, a[0]); // true | false
    return { id: u.id, name: u.name, role: u.role, email: u.email, phone: u.phone, levels, actions, seeNumbers: await this.perms.canSeeNumbers(au) };
  }

  // Change own password (needs the current one; minimum 8 characters).
  // A wrong current password is a 400 (bad input), not a 401: 401 means "you are not signed in" and makes the app sign you out.
  async changePassword(id: string, current: string, next: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new UnauthorizedException();
    if (!u.passwordHash || !(await bcrypt.compare(current || '', u.passwordHash))) throw new BadRequestException('Current password is wrong.');
    if (!next || next.length < 8) throw new BadRequestException('New password must be at least 8 characters.');
    if (next === current) throw new BadRequestException('New password must be different from the current one.');
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    await this.audit.log(u.name, 'account.password.change', u.name);
    return { ok: true };
  }
}
