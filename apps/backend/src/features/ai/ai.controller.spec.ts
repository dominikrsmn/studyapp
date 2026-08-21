import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { AiController } from './ai.controller';
import { QuestionAnsweringService } from './question-answering.service';

jest.mock('./question-answering.service', () => ({
  QuestionAnsweringService: class QuestionAnsweringService {},
}));

describe('AiController', () => {
  const questionAnsweringService = { answerQuestion: jest.fn() };
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  let controller: AiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: QuestionAnsweringService,
          useValue: questionAnsweringService,
        },
      ],
    }).compile();

    controller = module.get(AiController);
    jest.clearAllMocks();
  });

  it('answers a question for the requested module and current user', async () => {
    questionAnsweringService.answerQuestion.mockResolvedValue({
      answer: 'The answer',
    });

    await expect(
      controller.answerQuestion(request, 'module-id', {
        question: '  What is relevant?  ',
      }),
    ).resolves.toEqual({ answer: 'The answer' });
    expect(questionAnsweringService.answerQuestion).toHaveBeenCalledWith(
      'What is relevant?',
      'module-id',
      'user-id',
    );
  });

  it('rejects an empty question', () => {
    expect(() =>
      controller.answerQuestion(request, 'module-id', { question: '   ' }),
    ).toThrow(BadRequestException);
    expect(questionAnsweringService.answerQuestion).not.toHaveBeenCalled();
  });
});
