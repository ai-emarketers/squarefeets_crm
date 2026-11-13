// GET /api/health — liveness check (also proves the database answers). Public: no login needed.
import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.decorators';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  // `SELECT 1` fails if Postgres is down, so a 200 means API + DB are both up.
  @Public() @Get() async health() { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ok' }; }
}
