// TeamService — every rule about team members lives here, so the REST endpoints (TeamController) and the web app's
// /api/sync path (StateService) behave identically.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';

/** Roles an Owner/Admin may hand out. 'Owner' is never assignable: there is exactly one Owner, created by the seed. */
export const ASSIGNABLE_ROLES = ['Admin', 'Manager', 'Agent', 'Field staff'];
/** Statuses a member can have. 'Inactive' is the legacy spelling of 'Disabled' and is converted on save. */
export const STATUSES = ['Active', 'Invited', 'Disabled'];

/** Fields the web app / REST clients may send. Every field is optional on update (missing = keep the stored value). */
export interface TeamInput {
  name: string; role?: string; phone?: string; corp?: string; alt?: string;
  email?: string | null; status?: string; seeNumbers?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Team members without any sensitive field (no password hash, no phone numbers). */
  async list() {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((u) => ({ id: u.id, name: u.name, role: u.role, email: u.email, status: u.status, lastLoginAt: u.lastLoginAt }));
  }

  /**
   * Create or update one member (matched by unique name).
   * mode 'create' fails if the name exists, 'update' fails if it does not, 'any' does whichever fits (used by /api/sync).
   */
  async save(actor: AuthUser, t: TeamInput, mode: 'any' | 'create' | 'update' = 'any') {
    const name = String(t?.name ?? '').trim();
    if (!name) throw new BadRequestException('Name is required.');
    if (name.length > 80) throw new BadRequestException('Name is too long (80 characters max).');

    const existing = await this.prisma.user.findUnique({ where: { name } });
    if (mode === 'create' && existing) throw new ConflictException('A team member with this name already exists.');
    if (mode === 'update' && !existing) throw new NotFoundException('Team member not found.');
    // only the Owner may edit the Owner's row
    if (existing?.role === 'Owner' && actor.role !== 'Owner') throw new ForbiddenException('Only the owner can edit the owner.');

    // role: the Owner stays Owner; everyone else must have one of the assignable roles
    const role = existing?.role === 'Owner' ? 'Owner' : (t.role ?? existing?.role ?? 'Agent');
    if (role === 'Owner' ? existing?.role !== 'Owner' : !ASSIGNABLE_ROLES.includes(role)) throw new BadRequestException(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`);
    if (existing && existing.id === actor.id && role !== existing.role) throw new BadRequestException('You cannot change your own role.');

    // status: normalise the legacy spelling, then protect the owner and yourself from being locked out
    let status = t.status ?? existing?.status ?? 'Invited';
    if (status === 'Inactive') status = 'Disabled';
    if (!STATUSES.includes(status)) throw new BadRequestException(`Status must be one of: ${STATUSES.join(', ')}.`);
    if (status === 'Disabled' && existing?.status !== 'Disabled') {
      if (existing?.role === 'Owner') throw new BadRequestException('The owner cannot be deactivated.');
      if (existing && existing.id === actor.id) throw new BadRequestException('You cannot deactivate your own account.');
    }

    // email: optional, but when given it must look right and be unique (it is the sign-in name)
    let email: string | null = existing?.email ?? null;
    if (t.email !== undefined) {
      const e = String(t.email || '').trim().toLowerCase();
      if (e && !EMAIL_RE.test(e)) throw new BadRequestException('Enter a valid email address.');
      email = e || null;
    }
    if (email) {
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash && clash.id !== existing?.id) throw new ConflictException(`That email is already used by ${clash.name}.`);
    }

    // phone numbers: when the web app sends back a masked value ("98•••••21") keep the stored number
    const keep = (sent: string | undefined, cur: string | undefined) => (sent === undefined || (sent.includes('•') && existing) ? cur ?? '' : String(sent));
    const data = {
      name, role, status, email,
      phone: keep(t.phone, existing?.phone), corpPhone: keep(t.corp, existing?.corpPhone), altPhone: keep(t.alt, existing?.altPhone),
      seeNumbers: t.seeNumbers === undefined ? existing?.seeNumbers ?? false : !!t.seeNumbers,
    };

    if (!existing) {
      const u = await this.prisma.user.create({ data });
      await this.audit.log(actor.name, 'team.create', name, { role, status });
      return u;
    }

    // deactivating ends every sign-in the member already has (and keeps them dead if the account is re-activated later)
    const deactivating = status === 'Disabled' && existing.status !== 'Disabled';
    const u = await this.prisma.user.update({ where: { id: existing.id }, data: { ...data, ...(deactivating ? { sessionsValidFrom: new Date() } : {}) } });

    // audit: record WHICH fields changed (never the phone numbers themselves)
    const changed: string[] = [];
    if (existing.role !== role) changed.push('role');
    if ((existing.email ?? null) !== email) changed.push('email');
    if (existing.phone !== data.phone || existing.corpPhone !== data.corpPhone || existing.altPhone !== data.altPhone) changed.push('phone');
    if (existing.seeNumbers !== data.seeNumbers) changed.push('seeNumbers');
    if (changed.length) await this.audit.log(actor.name, 'team.update', name, { changed, ...(changed.includes('role') ? { role: { from: existing.role, to: role } } : {}) });
    if (existing.status !== status) await this.audit.log(actor.name, 'team.status', name, { from: existing.status, to: status });
    return u;
  }

  /** Remove a member. The Owner and yourself cannot be removed. Returns false when there was nothing to remove. */
  async remove(actor: AuthUser, name: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { name } });
    if (!u) return false;
    if (u.role === 'Owner') throw new ForbiddenException('The owner cannot be removed.');
    if (u.id === actor.id) throw new BadRequestException('You cannot remove your own account.');
    await this.prisma.user.delete({ where: { id: u.id } });
    await this.audit.log(actor.name, 'team.remove', name, { role: u.role });
    return true;
  }

  /** Owner/Admin sets or resets a member's password. Ends the member's current sign-ins; a new Invited member becomes Active. */
  async setPassword(actor: AuthUser, name: string, password: string, email?: string) {
    if (actor.role !== 'Owner' && actor.role !== 'Admin') throw new ForbiddenException('Only the owner or an admin can set passwords.');
    if (!password || password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
    const u = await this.prisma.user.findUnique({ where: { name } });
    if (!u) throw new NotFoundException('Team member not found.');
    if (u.role === 'Owner' && actor.role !== 'Owner') throw new ForbiddenException('Only the owner can set the owner\'s password.');

    let newEmail = u.email;
    if (email !== undefined && String(email).trim()) {
      const e = String(email).trim().toLowerCase();
      if (!EMAIL_RE.test(e)) throw new BadRequestException('Enter a valid email address.');
      const clash = await this.prisma.user.findUnique({ where: { email: e } });
      if (clash && clash.id !== u.id) throw new ConflictException(`That email is already used by ${clash.name}.`);
      newEmail = e;
    }
    if (!newEmail) throw new BadRequestException('Add a sign-in email for this member first.');

    await this.prisma.user.update({
      where: { id: u.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        email: newEmail,
        // only an Invited member is activated; a Disabled member stays disabled until someone re-activates them
        status: u.status === 'Invited' ? 'Active' : u.status,
        // reset = kick the member's existing sessions (but not your own, so you are not signed out of the screen you are on)
        ...(u.id === actor.id ? {} : { sessionsValidFrom: new Date() }),
      },
    });
    await this.audit.log(actor.name, 'team.password.reset', name, { emailChanged: newEmail !== u.email });
    return { ok: true };
  }
}
