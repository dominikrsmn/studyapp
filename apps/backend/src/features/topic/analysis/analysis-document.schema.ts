import type { DoclingDocument } from '@docling/docling-core';
import { z } from 'zod';

const refSchema = z
  .object({
    $ref: z.string().min(1),
  })
  .passthrough();

const boundingBoxSchema = z
  .object({
    l: z.number(),
    t: z.number(),
    r: z.number(),
    b: z.number(),
    coord_origin: z.enum(['TOPLEFT', 'BOTTOMLEFT']).optional(),
  })
  .passthrough();

const provenanceSchema = z
  .object({
    page_no: z.number().int().positive(),
    bbox: boundingBoxSchema,
    charspan: z.tuple([z.unknown(), z.unknown()]),
  })
  .passthrough();

const nodeFields = {
  self_ref: z.string().min(1),
  children: z.array(refSchema).optional(),
  prov: z.array(provenanceSchema).optional(),
};

const groupSchema = z
  .object({
    self_ref: nodeFields.self_ref,
    children: nodeFields.children,
  })
  .passthrough();

const documentItemSchema = z.object({
  ...nodeFields,
  label: z.string().min(1),
});

const textItemSchema = documentItemSchema
  .extend({
    text: z.string(),
    orig: z.string(),
    level: z.number().int().positive().optional(),
  })
  .passthrough();

const tableCellSchema = z.object({ text: z.string() }).passthrough();
const tableItemSchema = documentItemSchema
  .extend({
    data: z
      .object({
        grid: z.array(z.array(tableCellSchema)),
      })
      .passthrough(),
  })
  .passthrough();

const pictureAnnotationSchema = z
  .object({
    kind: z.string(),
    text: z.string().optional(),
  })
  .passthrough();
const pictureItemSchema = documentItemSchema
  .extend({
    annotations: z.array(pictureAnnotationSchema).optional(),
  })
  .passthrough();

export const analysisDocumentSchema = z
  .object({
    schema_name: z.literal('DoclingDocument'),
    name: z.string(),
    body: groupSchema,
    groups: z.array(groupSchema).optional(),
    texts: z.array(textItemSchema).optional(),
    pictures: z.array(pictureItemSchema).optional(),
    tables: z.array(tableItemSchema).optional(),
    key_value_items: z.array(documentItemSchema.passthrough()).optional(),
    form_items: z.array(documentItemSchema.passthrough()).optional(),
  })
  .passthrough();

export function parseAnalysisDocument(value: unknown): DoclingDocument {
  return analysisDocumentSchema.parse(value) as DoclingDocument;
}
