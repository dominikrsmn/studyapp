import { Module } from '@nestjs/common';
import { SourceService } from './source.service';
import { SourcesController } from './source.controller';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [PrismaModule, FileStorageModule, IngestionModule],
  providers: [SourceService],
  controllers: [SourcesController],
})
export class SourceModule {}
