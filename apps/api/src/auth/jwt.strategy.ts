// Passport strategy: reads the Bearer token, verifies its signature/expiry, then loads the user.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Validates the bearer token and loads the user (also rejects tokens issued before sessionsValidFrom).
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Configure how the bearer token is read and which secret verifies it.
  constructor(private prisma: PrismaService, cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // "Authorization: Bearer <token>"
      ignoreExpiration: false,                                   // expired tokens are rejected
      secretOrKey: cfg.get<string>('JWT_SECRET') || 'dev-secret-change-me', // same source as JwtModule — set JWT_SECRET in production!
    });
  }
  // Runs after the token is valid; the returned object becomes request.user.
  async validate(payload: { sub: string; iat?: number }) {
    const u = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // Re-check the DB each time so a disabled/deleted user is locked out immediately.
    if (!u || ['Disabled', 'Inactive'].includes(u.status)) throw new UnauthorizedException();
    // Tokens issued before the last password reset / deactivation are dead (iat is in whole seconds, so compare in seconds).
    if (u.sessionsValidFrom && (payload.iat ?? 0) < Math.floor(u.sessionsValidFrom.getTime() / 1000)) throw new UnauthorizedException();
    return { id: u.id, name: u.name, role: u.role, email: u.email, seeNumbers: u.seeNumbers };
  }
}
