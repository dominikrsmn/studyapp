import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingModule } from '../../infrastructure/embedding/embedding.module';
import { graphBuildConfig } from './graph-build.config';
import { GraphBuildQueue } from './graph-build.queue';
import { GraphBuildProcessor } from './graph-build.processor';
import { DispatchCandidatesJob } from './jobs/dispatch-candidates.job';
import { GetPrerequisitesJob } from './jobs/get-prerequisites.job';
import { LearningGraphService } from './learning-graph.service';
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
    DispatchCandidatesJob,
    GetPrerequisitesJob,
    LearningGraphService,
    RefineGraphJob,
    DetectCyclesJob,
  ],
  exports: [GraphBuildQueue, LearningGraphService],
})
export class LearningGraphModule {}
