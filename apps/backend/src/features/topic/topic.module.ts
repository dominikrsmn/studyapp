import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { TopicService } from './topic.service';

import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [AnalysisModule, PrismaModule, OpenAiModule],
  providers: [TopicService],
  exports: [TopicService],
})
export class TopicModule {}
