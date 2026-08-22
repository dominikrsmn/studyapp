import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ingestionConfig } from '../../features/ingestion/ingestion.config';
import { topicAnalysisConfig } from '../../features/topic/topic-analysis.config';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { TextProcessingService } from './text-processing.service';

@Module({
  imports: [
    ConfigModule.forFeature(ingestionConfig),
    ConfigModule.forFeature(topicAnalysisConfig),
    PrismaModule,
  ],
  providers: [TextProcessingService],
  exports: [TextProcessingService],
})
export class TextProcessingModule {}
