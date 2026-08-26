import { z } from 'zod';

const tableCellSchema = z
  .object({
    text: z.string().optional(),
  })
  .passthrough();

const annotationSchema = z
  .object({
    description: z.string().optional(),
  })
  .passthrough();

export interface AnalysisDocumentUnit {
  label: string;
  self_ref?: string;
  children?: AnalysisDocumentUnit[];
  prov?: Array<{
    page_no: number;
    bbox: {
      l: number;
      t: number;
      r: number;
      b: number;
      coord_origin?: 'TOPLEFT' | 'BOTTOMLEFT';
    };
  }>;
  text?: string;
  level?: number;
  data?: Array<Array<{ text?: string }>>;
  annotations?: Array<{ description?: string }>;
}

const analysisDocumentUnitSchema: z.ZodType<AnalysisDocumentUnit> = z.lazy(() =>
  z
    .object({
      label: z.string().min(1),
      self_ref: z.string().min(1).optional(),
      children: z.array(analysisDocumentUnitSchema).optional(),
      prov: z
        .array(
          z
            .object({
              page_no: z.number().int().positive(),
              bbox: z
                .object({
                  l: z.number(),
                  t: z.number(),
                  r: z.number(),
                  b: z.number(),
                  coord_origin: z.enum(['TOPLEFT', 'BOTTOMLEFT']).optional(),
                })
                .passthrough(),
            })
            .passthrough(),
        )
        .optional(),
      text: z.string().optional(),
      level: z.number().int().positive().optional(),
      data: z.array(z.array(tableCellSchema)).optional(),
      annotations: z.array(annotationSchema).optional(),
    })
    .passthrough(),
);

export interface AnalysisDocument {
  name: string;
  main_text?: AnalysisDocumentUnit[];
}

export const analysisDocumentSchema: z.ZodType<AnalysisDocument> = z
  .object({
    name: z.string(),
    main_text: z.array(analysisDocumentUnitSchema).optional(),
  })
  .passthrough();

export function parseAnalysisDocument(value: unknown): AnalysisDocument {
  return analysisDocumentSchema.parse(value);
}
