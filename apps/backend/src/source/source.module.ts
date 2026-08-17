import { Module } from '@nestjs/common';
import { SourceService } from './source.service';
import {
  ModuleSourcesController,
  SourcesController,
} from './source.controller';
import { PrismaModule } from '../database/prisma/prisma.module';
import { FileStorageModule } from '../filestorage/filestorage.module';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [PrismaModule, FileStorageModule, IngestionModule],
  providers: [SourceService],
  controllers: [SourcesController, ModuleSourcesController],
})
export class SourceModule {}
