import { Test, TestingModule } from '@nestjs/testing';
import { TopicCandidateConsolidatorService } from './topic-candidate-consolidator.service';

describe('TopicCandidateConsolidatorService', () => {
  let service: TopicCandidateConsolidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicCandidateConsolidatorService],
    }).compile();

    service = module.get<TopicCandidateConsolidatorService>(TopicCandidateConsolidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
