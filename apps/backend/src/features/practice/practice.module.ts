import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessment/assessment.module';
import { LearningGraphModule } from '../learning-graph/learning-graph.module';
import { RetrievalModule } from '../retrieval/retrieval.module';

@Module({
  imports: [AssessmentModule, LearningGraphModule, RetrievalModule],
})
export class PracticeModule {}
