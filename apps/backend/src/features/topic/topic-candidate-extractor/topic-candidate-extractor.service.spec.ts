import { Test, TestingModule } from '@nestjs/testing';
import { TopicCandidateExtractorService } from './topic-candidate-extractor.service';

describe('TopicCandidateExtractorService', () => {
  let service: TopicCandidateExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicCandidateExtractorService],
    }).compile();

    service = module.get<TopicCandidateExtractorService>(TopicCandidateExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
