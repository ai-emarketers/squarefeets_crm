// @Global so every module can inject PrismaService without importing PrismaModule again.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// PrismaModule: Nest module — wires this feature's controller and service together.
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
