import { Module } from '@nestjs/common';
import { SourceService } from './source.service';
import { SourcesController } from './source.controller';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SourceEventService } from './source-event.service';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { ingestionConfig } from '../ingestion/ingestion.config';
import { sourceConfig } from './source.config';

@Module({
  imports: [
    PrismaModule,
    FileStorageModule,
    IngestionModule,
    ConfigModule.forFeature(sourceConfig),
    ConfigModule.forFeature(ingestionConfig),
    MulterModule.registerAsync({
      imports: [ConfigModule.forFeature(ingestionConfig)],
      inject: [ingestionConfig.KEY],
      useFactory: (config: ConfigType<typeof ingestionConfig>) => ({
        limits: {
          fileSize: config.maxUploadBytes,
        },
      }),
    }),
  ],
  providers: [SourceService, SourceEventService],
  controllers: [SourcesController],
})
export class SourceModule {}
