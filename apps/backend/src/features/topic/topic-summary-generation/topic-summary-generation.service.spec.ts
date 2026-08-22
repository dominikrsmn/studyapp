import { Test, TestingModule } from '@nestjs/testing';
import { TopicSummaryGenerationService } from './topic-summary-generation.service';

describe('TopicSummaryGenerationService', () => {
  let service: TopicSummaryGenerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicSummaryGenerationService],
    }).compile();

    service = module.get<TopicSummaryGenerationService>(
      TopicSummaryGenerationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
