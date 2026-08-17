import { Logger, Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { FileStorageModule } from '../filestorage/filestorage.module';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PrismaModule } from '../database/prisma/prisma.module';
import { OpenAiModule } from '../open-ai/open-ai.module';

@Module({
  imports: [FileStorageModule, PrismaModule, OpenAiModule],
  providers: [
    IngestionService,
    PdfTextExtractorService,
    TextChunkerService,
    EmbeddingService,
    Logger,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
