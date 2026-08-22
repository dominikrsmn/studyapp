import { Test, TestingModule } from '@nestjs/testing';
import { TopicSummaryGeneratorService } from './topic-summary-generator.service';

describe('TopicSummaryGeneratorService', () => {
  let service: TopicSummaryGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicSummaryGeneratorService],
    }).compile();

    service = module.get<TopicSummaryGeneratorService>(TopicSummaryGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
