import { z } from 'zod';
import { userTopicStateSchema } from './user-topic-state.schema';

export const learningGraphNodeSchema = z
  .object({
    topicId: z.uuid(),
    title: z.string(),
    contentRevision: z.number().int().positive(),
    userState: userTopicStateSchema,
  })
  .refine(
    (node) =>
      node.topicId === node.userState.topicId &&
      node.contentRevision === node.userState.contentRevision,
    { message: 'User state must match the topic and content revision' },
  );

export const learningGraphEdgeSchema = z.object({
  prerequisiteTopicId: z.uuid(),
  dependentTopicId: z.uuid(),
});

export const learningGraphResponseSchema = z.discriminatedUnion('status', [
  z.object({ moduleId: z.uuid(), status: z.literal('pending') }),
  z.object({
    moduleId: z.uuid(),
    status: z.literal('ready'),
    nodes: z.array(learningGraphNodeSchema),
    edges: z.array(learningGraphEdgeSchema),
  }),
  z.object({
    moduleId: z.uuid(),
    status: z.literal('failed'),
    message: z.string(),
  }),
]);

export type LearningGraphNode = z.infer<typeof learningGraphNodeSchema>;
export type LearningGraphEdge = z.infer<typeof learningGraphEdgeSchema>;
export type LearningGraphResponse = z.infer<typeof learningGraphResponseSchema>;
