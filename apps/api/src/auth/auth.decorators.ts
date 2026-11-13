// Custom decorators used across the API for authentication and authorisation.
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// @Public() marks a route that needs no login (login, health). JwtAuthGuard looks for this flag.
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

// @Perm('deals') says which permission module governs a controller/route (see Organization.perms).
export const PERM_KEY = 'permModule';
/** Module permission (see Organization.perms.lv). GET => read, everything else => write. */
export const Perm = (module: string) => SetMetadata(PERM_KEY, module);

// @Act('import') requires a specific action permission (export*, import, seeNumbers, masters, approveExports).
export const ACT_KEY = 'permAction';
/** Action permission (export*, import, seeNumbers, masters, approveExports). */
export const Act = (...actions: string[]) => SetMetadata(ACT_KEY, actions);

// Shape of the signed-in user that JwtStrategy puts on request.user.
export interface AuthUser { id: string; name: string; role: string; email?: string; seeNumbers?: boolean }
// @CurrentUser() injects request.user into a controller method parameter.
export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
