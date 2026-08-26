import type {
  BoundingBox,
  DoclingDocument,
  NodeItem,
  PictureAnnotation,
  ProvenanceItem,
  TableCell,
} from 'docling-sdk';
import { z } from 'zod';

const tableCellSchema: z.ZodType<TableCell> = z
  .object({
    text: z.string(),
  })
  .passthrough();

const annotationSchema: z.ZodType<PictureAnnotation> = z
  .object({
    kind: z.string(),
    description: z.string().optional(),
  })
  .passthrough();

const boundingBoxSchema: z.ZodType<BoundingBox> = z
  .object({
    l: z.number(),
    t: z.number(),
    r: z.number(),
    b: z.number(),
    coord_origin: z.enum(['TOPLEFT', 'BOTTOMLEFT']).optional(),
  })
  .passthrough();

const provenanceSchema: z.ZodType<ProvenanceItem> = z
  .object({
    page_no: z.number().int().positive(),
    bbox: boundingBoxSchema,
  })
  .passthrough();

const analysisDocumentUnitSchema: z.ZodType<NodeItem> = z.lazy(() =>
  z
    .object({
      label: z.string().min(1),
      self_ref: z.string().min(1).optional(),
      children: z.array(analysisDocumentUnitSchema).optional(),
      prov: z.array(provenanceSchema).optional(),
      text: z.string().optional(),
      level: z.number().int().positive().optional(),
      data: z.array(z.array(tableCellSchema)).optional(),
      annotations: z.array(annotationSchema).optional(),
    })
    .passthrough(),
);

export const analysisDocumentSchema: z.ZodType<DoclingDocument> = z
  .object({
    name: z.string(),
    main_text: z.array(analysisDocumentUnitSchema).optional(),
  })
  .passthrough();

export function parseAnalysisDocument(value: unknown): DoclingDocument {
  return analysisDocumentSchema.parse(value);
}
