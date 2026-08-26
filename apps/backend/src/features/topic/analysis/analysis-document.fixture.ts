import type { DoclingDocument } from '@docling/docling-core';

type TestProvenance = {
  page_no: number;
  bbox: { l: number; t: number; r: number; b: number };
  charspan?: [number, number];
};

export type TestDocumentItem = {
  label: string;
  self_ref: string;
  text?: string;
  orig?: string;
  level?: number;
  children?: TestDocumentItem[];
  prov?: TestProvenance[];
  data?:
    Array<Array<{ text: string }>> | { grid: Array<Array<{ text: string }>> };
  annotations?: Array<{
    kind: string;
    text?: string;
    description?: string;
    provenance?: string;
  }>;
};

export function createTestDoclingDocument(
  name: string,
  rootItems: TestDocumentItem[],
): DoclingDocument {
  const texts: Array<Record<string, unknown>> = [];
  const tables: Array<Record<string, unknown>> = [];
  const pictures: Array<Record<string, unknown>> = [];

  const addItem = (item: TestDocumentItem): string => {
    const isTable = item.label === 'table' || item.label === 'document_index';
    const isPicture = item.label === 'picture' || item.label === 'chart';
    const collection = isTable ? tables : isPicture ? pictures : texts;
    const collectionName = isTable
      ? 'tables'
      : isPicture
        ? 'pictures'
        : 'texts';
    const pointer = `#/${collectionName}/${collection.length}`;
    const index = collection.length;

    collection.push({});
    const children = (item.children ?? []).map((child) => ({
      $ref: addItem(child),
    }));
    const prov = item.prov?.map((entry) => ({
      ...entry,
      charspan: entry.charspan ?? [0, 0],
    }));

    const normalized: Record<string, unknown> = {
      self_ref: item.self_ref,
      label: item.label,
      children,
      ...(prov ? { prov } : {}),
    };

    if (isTable) {
      normalized.data = Array.isArray(item.data)
        ? { grid: item.data }
        : (item.data ?? { grid: [] });
    } else if (isPicture) {
      normalized.annotations = (item.annotations ?? []).map((annotation) => ({
        ...annotation,
        text: annotation.text ?? annotation.description,
        provenance: annotation.provenance ?? 'test',
      }));
    } else {
      normalized.text = item.text ?? '';
      normalized.orig = item.orig ?? item.text ?? '';
      if (item.level !== undefined) {
        normalized.level = item.level;
      }
    }

    collection[index] = normalized;
    return pointer;
  };

  const bodyChildren = rootItems.map((item) => ({ $ref: addItem(item) }));

  return {
    schema_name: 'DoclingDocument',
    name,
    body: {
      self_ref: '#/body',
      children: bodyChildren,
    },
    groups: [],
    texts,
    tables,
    pictures,
    key_value_items: [],
    form_items: [],
  } as unknown as DoclingDocument;
}
