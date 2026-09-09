import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingModule } from '../../infrastructure/embedding/embedding.module';
import { graphBuildConfig } from './graph-build.config';
import { GraphBuildQueue } from './graph-build.queue';
import { GraphBuildProcessor } from './graph-build.processor';
import { GraphBuildBatchingService } from './graph-build-batching.service';
import { DispatchCandidateBatchesJob } from './jobs/dispatch-candidate-batches.job';
import { FindCandidatesJob } from './jobs/find-candidates.job';
import { CreateGraphJob } from './jobs/create-graph.job';
import { RefineGraphJob } from './jobs/refine-graph.job';
import { DetectCyclesJob } from './jobs/detect-cycles.job';

@Module({
  imports: [
    ConfigModule.forFeature(graphBuildConfig),
    EmbeddingModule,
    PrismaModule,
    BullModule.registerQueue({ name: graphBuildConfig().queue.name }),
    BullModule.registerFlowProducer({
      name: graphBuildConfig().flowProducer.name,
    }),
  ],
  providers: [
    GraphBuildQueue,
    GraphBuildProcessor,
    GraphBuildBatchingService,
    DispatchCandidateBatchesJob,
    FindCandidatesJob,
    CreateGraphJob,
    RefineGraphJob,
    DetectCyclesJob,
  ],
  exports: [GraphBuildQueue],
})
export class LearningGraphModule {}
