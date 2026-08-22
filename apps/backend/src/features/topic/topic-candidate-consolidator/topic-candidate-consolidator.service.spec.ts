import { Test, TestingModule } from '@nestjs/testing';
import { TopicCandidateConsolidationService } from './topic-candidate-consolidation.service';

describe('TopicCandidateConsolidatorService', () => {
  let service: TopicCandidateConsolidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicCandidateConsolidationService],
    }).compile();

    service = module.get<TopicCandidateConsolidationService>(
      TopicCandidateConsolidationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
