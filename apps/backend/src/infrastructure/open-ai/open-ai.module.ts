import { JobHistoryService } from './job-history.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma/prisma.module';
import { OpenAiService } from './open-ai.service';

@Module({
  imports: [PrismaModule],
  providers: [OpenAiService, JobHistoryService],
  exports: [OpenAiService, JobHistoryService],
})
export class OpenAiModule {}
