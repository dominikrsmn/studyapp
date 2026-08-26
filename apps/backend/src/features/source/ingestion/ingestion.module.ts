import { forwardRef, Logger, Module } from '@nestjs/common';
import { FileStorageModule } from '../../../infrastructure/filestorage/filestorage.module';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module';
import { OpenAiModule } from '../../../infrastructure/open-ai/open-ai.module';
import { ConfigModule } from '@nestjs/config';
import { ingestionConfig } from './ingestion.config';
import { BullModule } from '@nestjs/bullmq';
import { IngestionQueue } from './ingestion.queue';
import { IngestionProcessor } from './ingestion.processor';
import { EmbeddingModule } from '../../../infrastructure/embedding/embedding.module';
import { ParseDocumentJob } from './jobs/parse-document.job';
import { DoclingModule } from '../../../infrastructure/docling/docling.module';
import { SourceProcessingStageService } from './source-processing-stage.service';
import { BuildRagChunksJob } from './jobs/build-rag-chunks.job';
import { EmbedRagChunksJob } from './jobs/embed-rag-chunks.job';
import { FinalizeIngestionJob } from './jobs/finalize-ingestion.job';
import { SourceModule } from '../source.module';
import { AnalysisModule } from '../../topic/analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forFeature(ingestionConfig),
    BullModule.registerQueue({
      name: ingestionConfig().queue.name,
      defaultJobOptions: ingestionConfig().queue.defaultJobOptions,
    }),
    BullModule.registerFlowProducer({
      name: ingestionConfig().flowProducer.name,
    }),
    FileStorageModule,
    PrismaModule,
    OpenAiModule,
    EmbeddingModule,
    DoclingModule,
    forwardRef(() => AnalysisModule),
    forwardRef(() => SourceModule), // TODO: probably move source events into own module to avoid circular dependency (also in source module)
  ],
  providers: [
    IngestionQueue,
    IngestionProcessor,
    Logger,
    ParseDocumentJob,
    BuildRagChunksJob,
    EmbedRagChunksJob,
    FinalizeIngestionJob,
    SourceProcessingStageService,
  ],
  exports: [IngestionQueue, SourceProcessingStageService],
})
export class IngestionModule {}
