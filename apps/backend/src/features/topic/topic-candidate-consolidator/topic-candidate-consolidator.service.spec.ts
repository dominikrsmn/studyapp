import { TopicCandidateConsolidationService } from './topic-candidate-consolidation.service';

describe('TopicCandidateConsolidationService', () => {
  const candidates = [
    {
      title: 'Topic',
      description: 'Description',
      facts: [{ content: 'Fact', chunkIds: ['analysis-chunk:real'] }],
    },
  ];

  it('preserves valid provenance references', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: { candidates },
    });
    const service = new TopicCandidateConsolidationService(
      { client: { responses: { parse } } } as never,
      { consolidation: { model: 'test-model' } } as never,
    );

    await expect(service.consolidate(candidates)).resolves.toEqual(candidates);
  });

  it('rejects provenance invented during consolidation', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        candidates: [
          {
            ...candidates[0],
            facts: [{ content: 'Fact', chunkIds: ['fabricated-id'] }],
          },
        ],
      },
    });
    const service = new TopicCandidateConsolidationService(
      { client: { responses: { parse } } } as never,
      { consolidation: { model: 'test-model' } } as never,
    );

    await expect(service.consolidate(candidates)).rejects.toThrow(
      'unknown analysis chunk ID "fabricated-id"',
    );
  });
});
