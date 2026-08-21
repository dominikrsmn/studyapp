import { Injectable, NotImplementedException } from '@nestjs/common';
import type { SemanticSearchResult } from '@study/contracts';

@Injectable()
export class AnswerGenerationService {
  generateAnswer(
    _question: string,
    _chunks: SemanticSearchResult[],
    _userId: string,
  ): Promise<string> {
    throw new NotImplementedException('Answer generation is not implemented');
  }
}
