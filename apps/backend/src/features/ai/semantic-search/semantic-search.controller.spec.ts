import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchService } from './semantic-search.service';

jest.mock('./semantic-search.service', () => ({
  SemanticSearchService: class SemanticSearchService {},
}));

describe('SemanticSearchController', () => {
  let controller: SemanticSearchController;
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const semanticSearchService = { search: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemanticSearchController],
      providers: [
        { provide: SemanticSearchService, useValue: semanticSearchService },
      ],
    }).compile();

    controller = module.get(SemanticSearchController);
    jest.clearAllMocks();
  });

  it('searches the requested module for the current user', async () => {
    const results = [{ content: 'Relevant notes' }];
    semanticSearchService.search.mockResolvedValue(results);

    await expect(
      controller.search(request, 'module-id', { query: '  exam topics  ' }),
    ).resolves.toEqual(results);
    expect(semanticSearchService.search).toHaveBeenCalledWith(
      'exam topics',
      'module-id',
      'user-id',
    );
  });

  it('rejects an empty query', () => {
    expect(() =>
      controller.search(request, 'module-id', { query: '   ' }),
    ).toThrow(BadRequestException);
    expect(semanticSearchService.search).not.toHaveBeenCalled();
  });
});
