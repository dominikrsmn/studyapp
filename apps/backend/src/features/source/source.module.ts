import { forwardRef, Module } from '@nestjs/common';
import { SourceService } from './source.service';
import { SourcesController } from './source.controller';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { ingestionConfig } from './ingestion/ingestion.config';
import { sourceConfig } from './source.config';
import { SourceEventService } from './source-event.service';

@Module({
  imports: [
    PrismaModule,
    FileStorageModule,
    forwardRef(() => IngestionModule),
    ConfigModule.forFeature(sourceConfig),
    ConfigModule.forFeature(ingestionConfig),
    MulterModule.registerAsync({
      imports: [ConfigModule.forFeature(ingestionConfig)],
      inject: [ingestionConfig.KEY],
      useFactory: (config: ConfigType<typeof ingestionConfig>) => ({
        limits: {
          fileSize: config.upload.maxBytes,
        },
      }),
    }),
  ],
  providers: [SourceService, SourceEventService],
  exports: [SourceEventService],
  controllers: [SourcesController],
})
export class SourceModule {}
