// Two global guards run on every request: JwtAuthGuard (who are you?) then PermGuard (may you do this?).
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ACT_KEY, IS_PUBLIC, PERM_KEY } from './auth.decorators';
import { PermissionsService } from './permissions.service';

// Verifies the Bearer token. Routes marked @Public() skip the check.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  // Allow the request when a valid JWT is present, or when the route is marked @Public().
  canActivate(ctx: ExecutionContext) {
    const pub = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (pub) return true;
    return super.canActivate(ctx) as any; // delegates to passport-jwt (JwtStrategy)
  }
}

// Enforces @Perm(module) and @Act(action) metadata against the signed-in user's role.
@Injectable()
export class PermGuard implements CanActivate {
  constructor(private reflector: Reflector, private perms: PermissionsService) {}
  // Check the role's access level for the module/action the route declares; reject with 403 when it is too low.
  async canActivate(ctx: ExecutionContext) {
    const mod = this.reflector.getAllAndOverride<string>(PERM_KEY, [ctx.getHandler(), ctx.getClass()]);
    const acts = this.reflector.getAllAndOverride<string[]>(ACT_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) return true; // public route: nothing to check
    if (mod) {
      // GET needs read access; POST/PATCH/DELETE need write access.
      const lvl = await this.perms.level(req.user, mod);
      const need = req.method === 'GET' ? 'read' : 'write';
      if (lvl === 'none' || (need === 'write' && lvl !== 'write')) throw new ForbiddenException(`You do not have ${need} access to ${mod}.`);
    }
    if (acts?.length) {
      for (const a of acts) if (!(await this.perms.can(req.user, a))) throw new ForbiddenException(`You are not allowed to: ${a}.`);
    }
    return true;
  }
}
