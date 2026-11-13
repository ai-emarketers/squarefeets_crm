// PrismaService = the single database client used by the whole API.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Database client shared by the whole API; connects on start and disconnects on shutdown.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Open the connection when Nest starts, close it on shutdown.
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  /**
   * Atomic human-readable sequence, stored in the Counter table.
   * next('DEAL', 146) -> 146 the first time, then 147, 148 … (upsert makes it safe under concurrency).
   */
  async next(key: string, start: number): Promise<number> {
    const row = await this.counter.upsert({
      where: { key },
      create: { key, n: start },       // first use: start the sequence
      update: { n: { increment: 1 } }, // later uses: +1
    });
    return row.n;
  }
}
