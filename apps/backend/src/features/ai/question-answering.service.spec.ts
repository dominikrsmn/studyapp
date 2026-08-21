import { AnswerGenerationService } from './answer-generation.service';
import { QuestionAnsweringService } from './question-answering.service';
import { SemanticSearchService } from './semantic-search/semantic-search.service';

jest.mock('./semantic-search/semantic-search.service', () => ({
  SemanticSearchService: class SemanticSearchService {},
}));

describe('QuestionAnsweringService', () => {
  const semanticSearchService = { search: jest.fn() };
  const answerGenerationService = { generateAnswer: jest.fn() };
  let service: QuestionAnsweringService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuestionAnsweringService(
      semanticSearchService as unknown as SemanticSearchService,
      answerGenerationService as unknown as AnswerGenerationService,
    );
  });

  it('searches for relevant chunks before generating an answer', async () => {
    const chunks = [
      {
        citationLabel: 'S1',
        sourceId: 'source-id',
        sourceName: 'Lecture notes',
        content: 'Relevant notes',
        pageStart: 2,
        pageEnd: 3,
      },
    ];
    semanticSearchService.search.mockResolvedValue(chunks);
    answerGenerationService.generateAnswer.mockResolvedValue('The answer');

    await expect(
      service.answerQuestion('What is relevant?', 'module-id', 'user-id'),
    ).resolves.toEqual({ answer: 'The answer' });
    expect(semanticSearchService.search).toHaveBeenCalledWith(
      'What is relevant?',
      'module-id',
      'user-id',
    );
    expect(answerGenerationService.generateAnswer).toHaveBeenCalledWith(
      'What is relevant?',
      chunks,
      'user-id',
    );
    expect(
      semanticSearchService.search.mock.invocationCallOrder[0],
    ).toBeLessThan(
      answerGenerationService.generateAnswer.mock.invocationCallOrder[0],
    );
  });
});
