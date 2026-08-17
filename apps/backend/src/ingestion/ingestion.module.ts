import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { FileStorageModule } from '../filestorage/filestorage.module';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';
import { EmbeddingService } from './embedding/embedding.service';

@Module({
  imports: [FileStorageModule],
  providers: [
    IngestionService,
    PdfTextExtractorService,
    TextChunkerService,
    EmbeddingService,
  ],
})
export class IngestionModule {}
