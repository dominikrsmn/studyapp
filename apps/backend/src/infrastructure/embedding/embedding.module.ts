import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';
import { embeddingConfig } from '../config/embedding.config';
import { OpenAiModule } from '../open-ai/open-ai.module';
import { BullModule } from '@nestjs/bullmq';
import { EmbeddingQueue } from './embedding.queue';
import { EmbeddingProcessor } from './embedding.processor';
import { EmbeddingBatchingService } from './embedding-batching.service';
import { CreateTopicEmbeddingsJob } from './jobs/create-topic-embeddings.job';
import { CreateEvidenceEmbeddingsJob } from './jobs/create-evidence-embeddings.job';

@Module({
  imports: [
    ConfigModule.forFeature(embeddingConfig),
    OpenAiModule,
    BullModule.registerQueue({ name: embeddingConfig().queue.name }),
  ],
  providers: [
    EmbeddingService,
    EmbeddingQueue,
    EmbeddingProcessor,
    EmbeddingBatchingService,
    CreateTopicEmbeddingsJob,
    CreateEvidenceEmbeddingsJob,
  ],
  exports: [EmbeddingService, EmbeddingQueue, EmbeddingBatchingService],
})
export class EmbeddingModule {}
