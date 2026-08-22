import { Test, TestingModule } from '@nestjs/testing';
import { TopicCandidateExtractionService } from './topic-candidate-extraction.service';

describe('TopicCandidateExtractorService', () => {
  let service: TopicCandidateExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicCandidateExtractionService],
    }).compile();

    service = module.get<TopicCandidateExtractionService>(
      TopicCandidateExtractionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
