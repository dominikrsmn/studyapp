import { TopicCandidateExtractionService } from './topic-candidate-extraction.service';
import type { AnalysisChunk } from '../topic.types';

describe('TopicCandidateExtractionService', () => {
  const makeChunk = (id: string, pageNumber: number): AnalysisChunk => ({
    id,
    content: `content for ${id} <untrusted>`,
    sourceId: 'source-id',
    sourcePageId: `page-${pageNumber}`,
    pageNumber,
    chunkIndex: 0,
    startOffset: 0,
    endOffset: 20,
  });

  it('uses stable chunk IDs across batches and validates returned references', async () => {
    const parse = jest.fn().mockImplementation(({ input }) => {
      const userContent = input[1].content as string;
      const chunkId = userContent.match(/<chunk id="([^"]+)"/)?.[1];
      return Promise.resolve({
        output_parsed: {
          candidates: [
            {
              title: `Topic ${chunkId}`,
              description: 'Description',
              facts: [{ content: 'Fact', chunkIds: [chunkId, chunkId] }],
            },
          ],
        },
      });
    });
    const service = new TopicCandidateExtractionService(
      { client: { responses: { parse } } } as never,
      { extraction: { batchSize: 1, model: 'test-model' } } as never,
    );

    const candidates = await service.extract([
      makeChunk('analysis-chunk:first', 1),
      makeChunk('analysis-chunk:second', 2),
    ]);

    expect(candidates.map(({ facts }) => facts[0].chunkIds)).toEqual([
      ['analysis-chunk:first'],
      ['analysis-chunk:second'],
    ]);
    expect(parse).toHaveBeenCalledTimes(2);
    const prompts = parse.mock.calls.map(
      ([request]) => request.input[1].content as string,
    );
    expect(prompts[0]).toContain(
      '<chunk id="analysis-chunk:first" sourceId="source-id" sourcePageId="page-1" pageNumber="1"',
    );
    expect(prompts[1]).toContain(
      '<chunk id="analysis-chunk:second" sourceId="source-id" sourcePageId="page-2" pageNumber="2"',
    );
    expect(prompts[0]).toContain('&lt;untrusted&gt;');
  });

  it('rejects a model-authored chunk ID', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        candidates: [
          {
            title: 'Topic',
            description: 'Description',
            facts: [{ content: 'Fact', chunkIds: ['fabricated-id'] }],
          },
        ],
      },
    });
    const service = new TopicCandidateExtractionService(
      { client: { responses: { parse } } } as never,
      { extraction: { batchSize: 1, model: 'test-model' } } as never,
    );

    await expect(
      service.extract([makeChunk('analysis-chunk:real', 1)]),
    ).rejects.toThrow('unknown analysis chunk ID "fabricated-id"');
  });
});
