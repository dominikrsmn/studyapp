import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { Pool } from 'pg';

export interface DatabasePoolState {
  total: number;
  idle: number;
  waiting: number;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(config: ConfigService<Env, true>) {
    const logger = new Logger(PrismaService.name);
    const pool = new Pool({
      connectionString: config.getOrThrow('DATABASE_URL'),
    });
    const logDriverError = (scope: string, error: Error) => {
      logger.error(
        `${scope}: ${error.message}; pool=${JSON.stringify(poolState(pool))}`,
        error.stack,
      );
    };
    const adapter = new PrismaPg(pool, {
      disposeExternalPool: true,
      onPoolError: (error) => logDriverError('PostgreSQL pool error', error),
      onConnectionError: (error) =>
        logDriverError('PostgreSQL connection error', error),
    });

    super({ adapter });
    this.pool = pool;
  }

  getPoolState(): DatabasePoolState {
    return poolState(this.pool);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function poolState(pool: Pool): DatabasePoolState {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
