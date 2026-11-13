// Answers "may this user do X?" using the role × module matrix stored in Organization.perms
// (the same matrix the Settings screen edits).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth.decorators';

// Column order of every row in the permission matrix: lv[module] = [Admin, Manager, Agent, Field staff].
export const ROLES = ['Admin', 'Manager', 'Agent', 'Field staff'];
// Access level of a role on a module: none, read-only, or read-write.
export type Level = 'none' | 'read' | 'write';

// Looks up what each role may do on each module and applies masking rules.
@Injectable()
export class PermissionsService {
  // Tiny 5-second cache so we don't hit the database for the matrix on every request.
  private cache: { at: number; perms: any } | null = null;
  constructor(private prisma: PrismaService) {}

  // Load the matrix (from cache if fresh).
  async perms() {
    if (this.cache && Date.now() - this.cache.at < 5000) return this.cache.perms;
    const org = await this.prisma.organization.findUnique({ where: { id: 'org' } });
    const perms = (org?.perms as any) || {};
    this.cache = { at: Date.now(), perms };
    return perms;
  }
  // Called after the matrix is changed so the new rules apply immediately.
  invalidate() { this.cache = null; }

  // Access level ('none' | 'read' | 'write') of a user for one module. The Owner always has full access.
  async level(user: AuthUser, module: string): Promise<Level> {
    if (user.role === 'Owner') return 'write';
    const p = await this.perms();
    const idx = Math.max(0, ROLES.indexOf(user.role));
    return (p.lv?.[module]?.[idx] as Level) || 'none';
  }
  // Whether the user's role is allowed a named action (e.g. 'import', 'exportLeads', 'masters').
  async can(user: AuthUser, action: string): Promise<boolean> {
    if (user.role === 'Owner') return true;
    const p = await this.perms();
    const row = (p.act || []).find((a: any) => a[0] === action);
    if (!row) return false;
    return !!row[2]?.[Math.max(0, ROLES.indexOf(user.role))];
  }
  // Full phone numbers / emails are shown only to users with this permission (or the per-user override flag).
  async canSeeNumbers(user: AuthUser) {
    return user.role === 'Owner' || user.seeNumbers === true || (await this.can(user, 'seeNumbers'));
  }
}
