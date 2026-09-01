import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { TopicService } from './topic.service';

import { OpenAiModule } from '../../infrastructure/open-ai/open-ai.module';
import { AnalysisModule } from './analysis/analysis.module';
import { TopicController } from './topic.controller';

@Module({
  imports: [AnalysisModule, PrismaModule, OpenAiModule],
  controllers: [TopicController],
  providers: [TopicService],
  exports: [TopicService],
})
export class TopicModule {}
