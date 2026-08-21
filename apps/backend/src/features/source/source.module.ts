import { Module } from '@nestjs/common';
import { SourceService } from './source.service';
import { SourcesController } from './source.controller';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SourceEventService } from './source-event.service';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../../infrastructure/config/env.schema';

@Module({
  imports: [
    PrismaModule,
    FileStorageModule,
    IngestionModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        limits: {
          fileSize: config.get('INGESTION_MAX_UPLOAD_BYTES', { infer: true }),
        },
      }),
    }),
  ],
  providers: [SourceService, SourceEventService],
  controllers: [SourcesController],
})
export class SourceModule {}
