// Authentication endpoints: POST /api/auth/login · GET /api/auth/me · POST /api/auth/password
import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './auth.decorators';

// Request body of /login, validated automatically by the global ValidationPipe.
class LoginDto { @IsEmail() email: string; @IsString() password: string; }

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  // Only public route besides /health — everything else requires a token.
  @Public() @Post('login') login(@Body() b: LoginDto) { return this.auth.login(b.email, b.password); }
  // Who am I + what may I do (used by the web app on start-up).
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.auth.profile(u.id); }
  // Change my own password.
  @Post('password') pw(@CurrentUser() u: AuthUser, @Body() b: { current: string; next: string }) { return this.auth.changePassword(u.id, b.current, b.next); }
}
