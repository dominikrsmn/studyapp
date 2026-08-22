import { TopicMergingService } from './topic-merging.service';
import type { ModuleTopic, TopicCandidate, TopicMerging } from '../topic.types';

describe('TopicMergingService', () => {
  const existingTopicId = '4d4a1598-d397-4033-bb23-f4b14488582c';
  const secondExistingTopicId = 'd8ed6b3a-d040-4600-b5ac-18685ac70f2b';

  const candidates: TopicCandidate[] = [
    {
      title: 'First candidate',
      description: 'First description',
      facts: [{ content: 'First fact', chunkIds: ['chunk-1'] }],
    },
    {
      title: 'Second candidate',
      description: 'Second description',
      facts: [{ content: 'Second fact', chunkIds: ['chunk-2'] }],
    },
    {
      title: 'Third candidate',
      description: 'Third description',
      facts: [{ content: 'Third fact', chunkIds: ['chunk-3'] }],
    },
  ];

  const topics = [
    {
      id: existingTopicId,
      title: 'Existing topic',
      description: 'Existing description',
      summary: null,
      evidence: [],
    },
    {
      id: secondExistingTopicId,
      title: 'Second existing topic',
      description: 'Second existing description',
      summary: null,
      evidence: [],
    },
  ] as ModuleTopic[];

  const createService = (parse: jest.Mock) =>
    new TopicMergingService(
      { client: { responses: { parse } } } as never,
      { merging: { model: 'test-model' } } as never,
    );

  it('returns a valid total partition without changing the parsed result', async () => {
    const parsed: TopicMerging = {
      existingTopicMatches: [
        { topicId: existingTopicId, candidateIndexes: [0, 1] },
      ],
      newTopics: [
        {
          title: 'New topic',
          description: 'New description',
          candidateIndexes: [2],
        },
      ],
    };
    const parse = jest.fn().mockResolvedValue({ output_parsed: parsed });

    const result = await createService(parse).merge(candidates, topics);

    expect(result).toBe(parsed);
    const request = parse.mock.calls[0][0];
    expect(request.model).toBe('test-model');
    expect(JSON.stringify(request.text.format)).toContain('candidateIndexes');
    expect(JSON.stringify(request)).not.toMatch(/reconcil/i);
  });

  it.each([
    ['a non-integer', 0.5],
    ['a negative integer', -1],
    ['an out-of-range integer', 3],
    ['a numeric string', '0' as unknown as number],
  ])('rejects %s candidate index', async (_, invalidIndex) => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        existingTopicMatches: [],
        newTopics: [
          {
            title: 'New topic',
            description: 'New description',
            candidateIndexes: [invalidIndex],
          },
        ],
      },
    });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow(`unknown candidate index "${invalidIndex}"`);
  });

  it('rejects a candidate repeated within one entry', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        existingTopicMatches: [],
        newTopics: [
          {
            title: 'New topic',
            description: 'New description',
            candidateIndexes: [0, 0, 1, 2],
          },
        ],
      },
    });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow('candidate index "0" more than once');
  });

  it('rejects a candidate repeated across existing and new topics', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        existingTopicMatches: [
          { topicId: existingTopicId, candidateIndexes: [0, 1] },
        ],
        newTopics: [
          {
            title: 'New topic',
            description: 'New description',
            candidateIndexes: [0, 2],
          },
        ],
      },
    });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow('candidate index "0" more than once');
  });

  it('rejects omitted candidate indexes and lists all of them', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        existingTopicMatches: [
          { topicId: existingTopicId, candidateIndexes: [0] },
        ],
        newTopics: [],
      },
    });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow('omitted candidate indexes: 1, 2');
  });

  it('rejects an existing topic ID that was not provided', async () => {
    const unknownTopicId = '3a9d407d-15d6-4eb4-8a7f-b16ee4494404';
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        existingTopicMatches: [
          { topicId: unknownTopicId, candidateIndexes: [0, 1, 2] },
        ],
        newTopics: [],
      },
    });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow(`unknown existing topic ID "${unknownTopicId}"`);
  });

  it('rejects the same existing topic in multiple match entries', async () => {
    const parse = jest.fn().mockResolvedValue({
      output_parsed: {
        existingTopicMatches: [
          { topicId: existingTopicId, candidateIndexes: [0] },
          { topicId: existingTopicId, candidateIndexes: [1, 2] },
        ],
        newTopics: [],
      },
    });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow(`existing topic "${existingTopicId}" more than once`);
  });

  it('rejects a response without parsed output', async () => {
    const parse = jest.fn().mockResolvedValue({ output_parsed: null });

    await expect(
      createService(parse).merge(candidates, topics),
    ).rejects.toThrow('Topic merging returned no parsed output');
  });
});
