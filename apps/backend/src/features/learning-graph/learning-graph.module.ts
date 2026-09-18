import { GroupTopicsJob } from './jobs/group-topics.job';
import { PublishGraphJob } from './jobs/publish-graph.job';
import { LearningGraphController } from './learning-graph.controller';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingModule } from '../../infrastructure/embedding/embedding.module';
import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { graphBuildConfig } from './graph-build.config';
import { GraphBuildQueue } from './graph-build.queue';
import { GraphBuildProcessor } from './graph-build.processor';
import { DispatchCandidatesJob } from './jobs/dispatch-candidates.job';
import { GetPrerequisitesJob } from './jobs/get-prerequisites.job';
import { LearningGraphService } from './learning-graph.service';
import { RefineGraphJob } from './jobs/refine-graph.job';
import { DetectCyclesJob } from './jobs/detect-cycles.job';
import { GraphBuildEventsListener } from './graph-build.events-listener';
import { RecoverGraphJob } from './jobs/recover-graph.job';

@Module({
  imports: [
    ConfigModule.forFeature(graphBuildConfig),
    EmbeddingModule,
    OpenAiModule,
    PrismaModule,
    BullModule.registerQueue({ name: graphBuildConfig().queue.name }),
    BullModule.registerFlowProducer({
      name: graphBuildConfig().flowProducer.name,
    }),
  ],
  controllers: [LearningGraphController],
  providers: [
    GraphBuildQueue,
    GraphBuildProcessor,
    GraphBuildEventsListener,
    DispatchCandidatesJob,
    GetPrerequisitesJob,
    LearningGraphService,
    RefineGraphJob,
    GroupTopicsJob,
    PublishGraphJob,
    RecoverGraphJob,
    DetectCyclesJob,
  ],
  exports: [GraphBuildQueue, LearningGraphService],
})
export class LearningGraphModule {}
