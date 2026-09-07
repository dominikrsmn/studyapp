import {
  learningGraphResponseSchema,
  practiceSessionResponseSchema,
  userTopicStateSchema,
} from '@study/contracts';

const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';

describe('learning loop contracts', () => {
  it('distinguishes missing evidence from measured zero mastery', () => {
    const scope = { userId: id, topicId: id, contentRevision: 1 };
    expect(
      userTopicStateSchema.safeParse({ ...scope, status: 'unobserved' })
        .success,
    ).toBe(true);
    expect(
      userTopicStateSchema.safeParse({ ...scope, status: 'observed' }).success,
    ).toBe(false);
    expect(
      userTopicStateSchema.safeParse({
        ...scope,
        status: 'observed',
        mastery: 0,
        observationCount: 1,
        lastObservationId: id,
        updatedAt: '2026-09-07T12:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('requires ready graph data and rejects stale topic projections', () => {
    expect(
      learningGraphResponseSchema.safeParse({ moduleId: id, status: 'pending' })
        .success,
    ).toBe(true);
    expect(
      learningGraphResponseSchema.safeParse({ moduleId: id, status: 'ready' })
        .success,
    ).toBe(false);
    expect(
      learningGraphResponseSchema.safeParse({
        moduleId: id,
        status: 'ready',
        nodes: [],
        edges: [],
      }).success,
    ).toBe(true);
    expect(
      learningGraphResponseSchema.safeParse({
        moduleId: id,
        status: 'ready',
        edges: [],
        nodes: [
          {
            topicId: id,
            title: 'Topic',
            contentRevision: 2,
            userState: {
              userId: id,
              topicId: id,
              contentRevision: 1,
              status: 'unobserved',
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires the appropriate session payload and rejects unknown states', () => {
    for (const status of [
      'answering',
      'assessing',
      'feedback',
      'completed',
      'failed',
      'unknown',
    ]) {
      expect(
        practiceSessionResponseSchema.safeParse({ id, moduleId: id, status })
          .success,
      ).toBe(false);
    }
    const parsed = practiceSessionResponseSchema.parse({
      id,
      moduleId: id,
      status: 'answering',
      question: {
        id,
        topicId: id,
        contentRevision: 1,
        prompt: 'Explain.',
        expectedAnswer: 'Secret',
      },
    });
    expect(parsed.status === 'answering' && parsed.question).not.toHaveProperty(
      'expectedAnswer',
    );
  });

  it('rejects feedback from a different session and out-of-range scores', () => {
    const observation = {
      id,
      userId: id,
      moduleId: id,
      topicId: id,
      contentRevision: 1,
      sessionId: id,
      attemptId: id,
      occurredAt: '2026-09-07T12:00:00Z',
      score: 0.5,
      feedback: 'Partially correct',
    };
    const response = { id, moduleId: id, status: 'feedback', observation };
    expect(practiceSessionResponseSchema.safeParse(response).success).toBe(
      true,
    );
    expect(
      practiceSessionResponseSchema.safeParse({
        ...response,
        observation: { ...observation, sessionId: otherId },
      }).success,
    ).toBe(false);
    expect(
      practiceSessionResponseSchema.safeParse({
        ...response,
        observation: { ...observation, score: 2 },
      }).success,
    ).toBe(false);
  });
});
