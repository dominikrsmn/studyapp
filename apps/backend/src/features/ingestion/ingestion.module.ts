import { Logger, Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { FileStorageModule } from '../../infrastructure/filestorage/filestorage.module';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { ConfigModule } from '@nestjs/config';
import { ingestionConfig } from './ingestion.config';

@Module({
  imports: [
    ConfigModule.forFeature(ingestionConfig),
    FileStorageModule,
    PrismaModule,
    OpenAiModule,
  ],
  providers: [
    IngestionService,
    PdfTextExtractorService,
    TextChunkerService,
    EmbeddingService,
    Logger,
  ],
  exports: [IngestionService, EmbeddingService],
})
export class IngestionModule {}
