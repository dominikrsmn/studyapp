import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { analysisConfig } from './analysis.config';
import { SourceModule } from '../../source/source.module';

@Module({
  imports: [
    ConfigModule.forFeature(analysisConfig),
    BullModule.registerQueue({
      name: analysisConfig().queue.name,
      defaultJobOptions: analysisConfig().queue.defaultJobOptions,
    }),
    SourceModule,
  ],
  providers: [Logger],
})
export class AnalysisModule {}
