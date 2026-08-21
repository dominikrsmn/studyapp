import { Injectable } from '@nestjs/common';
import type { QuestionAnsweringResponse } from '@study/contracts';
import { AnswerGenerationService } from './answer-generation.service';
import { SemanticSearchService } from './semantic-search/semantic-search.service';

@Injectable()
export class QuestionAnsweringService {
  constructor(
    private readonly semanticSearchService: SemanticSearchService,
    private readonly answerGenerationService: AnswerGenerationService,
  ) {}

  async answerQuestion(
    question: string,
    moduleId: string,
    userId: string,
  ): Promise<QuestionAnsweringResponse> {
    const chunks = await this.semanticSearchService.search(
      question,
      moduleId,
      userId,
    );
    const answer = await this.answerGenerationService.generateAnswer(
      question,
      chunks,
      userId,
    );

    return { answer };
  }
}
