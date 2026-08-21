import { z } from 'zod';

export const questionAnsweringRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
});

export const questionAnsweringResponseSchema = z.object({
  answer: z.string(),
});

export type QuestionAnsweringRequest = z.infer<
  typeof questionAnsweringRequestSchema
>;
export type QuestionAnsweringResponse = z.infer<
  typeof questionAnsweringResponseSchema
>;
