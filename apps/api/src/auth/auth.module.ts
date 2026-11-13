// Authentication module. @Global so PermissionsService/AuthService can be injected anywhere.
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard, PermGuard } from './guards';

@Global()
@Module({
  imports: [
    PassportModule,
    // Tokens are signed with JWT_SECRET and expire after JWT_EXPIRES_IN (default 7 days).
    // registerAsync + ConfigService: the values are read AFTER apps/api/.env has been loaded. (A plain register()
    // would read process.env while this file is first imported — before .env is loaded — and sign tokens with a
    // different secret than JwtStrategy verifies them with, so every request after login would be rejected.)
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') || 'dev-secret-change-me',
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES_IN') || '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, JwtStrategy, PermissionsService,
    // APP_GUARD = applied to EVERY route automatically: first authenticate, then authorise.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermGuard },
  ],
  exports: [PermissionsService, AuthService],
})
export class AuthModule {}
