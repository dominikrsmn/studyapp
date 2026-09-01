import { Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { parseAnalysisDocument } from '../analysis-document.schema';
import { createTestDoclingDocument } from '../analysis-document.fixture';
import {
  boundaryDetectionPrompt,
  DetectBoundariesJob,
  documentUnitContent,
  indexDocumentUnits,
  serializeDocumentUnits,
} from './detect-boundaries.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class OpenAiService {},
}));
jest.mock('../../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));

describe('DetectBoundariesJob', () => {
  const sourceId = 'source-id';
  const document = parseAnalysisDocument(
    createTestDoclingDocument('Algorithms', [
      {
        label: 'section_header',
        self_ref: 'r142',
        text: "Dijkstra's Algorithm",
        level: 2,
        children: [
          {
            label: 'paragraph',
            self_ref: 'r143',
            text: 'Dijkstra finds shortest paths with non-negative weights.',
          },
          {
            label: 'paragraph',
            self_ref: 'r144',
            text: 'This worked example applies Dijkstra.',
          },
        ],
      },
      {
        label: 'section_header',
        self_ref: 'r145',
        text: 'Bellman-Ford',
        level: 2,
      },
    ]),
  );
  const findUnique = jest.fn();
  const readDoclingDocument = jest.fn();
  const parse = jest.fn();
  const transition = jest.fn();
  const config = analysisConfig();

  let job: DetectBoundariesJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findUnique.mockResolvedValue({ id: sourceId });
    readDoclingDocument.mockResolvedValue(
      Buffer.from(JSON.stringify(document)),
    );
    parse.mockResolvedValue({
      output_parsed: {
        boundaries: [{ afterRef: 'r144', confidence: 0.86 }],
      },
    });
    transition.mockResolvedValue({ id: 'stage-id' });

    job = new DetectBoundariesJob(
      { source: { findUnique } } as unknown as PrismaService,
      { readDoclingDocument } as unknown as FileStorageService,
      { client: { responses: { parse } } } as unknown as OpenAiService,
      { transition } as unknown as SourceProcessingStageService,
      config,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks for structured boundaries using only eligible supplied references', async () => {
    await expect(
      job.process({
        sourceId,
        analysisUnit: {
          index: 3,
          documentUnitRefs: ['r142', 'r143', 'r144', 'r145'],
        },
      }),
    ).resolves.toEqual({
      boundaries: [{ afterRef: 'r144', confidence: 0.86 }],
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: sourceId },
      select: { id: true },
    });
    expect(parse).toHaveBeenCalledTimes(1);

    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: config.boundaryDetection.model,
      reasoning: { effort: config.boundaryDetection.reasoningEffort },
      input: [
        { role: 'developer', content: expect.any(String) },
        { role: 'user', content: expect.any(String) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'document_topic_boundaries',
          strict: true,
        },
      },
    });
    expect(request.input[1].content).toContain(
      '<unit ref="r142" type="heading" level="2">',
    );
    expect(request.input[1].content).toContain('Dijkstra&apos;s Algorithm');

    const schemaText = JSON.stringify(request.text.format.schema);
    expect(schemaText).toContain('r142');
    expect(schemaText).toContain('r143');
    expect(schemaText).toContain('r144');
    expect(schemaText).not.toContain('r145');
  });

  it('explicitly accepts an empty boundaries array', async () => {
    parse.mockResolvedValue({ output_parsed: { boundaries: [] } });

    await expect(
      job.process({
        sourceId,
        analysisUnit: { index: 0, documentUnitRefs: ['r142', 'r143'] },
      }),
    ).resolves.toEqual({ boundaries: [] });
  });

  it('does not call the model when there is no pair to classify', async () => {
    await expect(
      job.process({
        sourceId,
        analysisUnit: { index: 0, documentUnitRefs: ['r142'] },
      }),
    ).resolves.toEqual({ boundaries: [] });

    expect(parse).not.toHaveBeenCalled();
  });

  it('rejects model output containing an unsupplied reference', async () => {
    parse.mockResolvedValue({
      output_parsed: {
        boundaries: [{ afterRef: 'invented-ref', confidence: 0.9 }],
      },
    });

    await expect(
      job.process({
        sourceId,
        analysisUnit: { index: 0, documentUnitRefs: ['r142', 'r143'] },
      }),
    ).rejects.toThrow();

    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
  });

  it('fails when a requested unit cannot be resolved', async () => {
    await expect(
      job.process({
        sourceId,
        analysisUnit: { index: 0, documentUnitRefs: ['r142', 'missing'] },
      }),
    ).rejects.toThrow('Document unit reference "missing" does not exist');

    expect(parse).not.toHaveBeenCalled();
  });

  it('rejects a malformed stored document before resolving its references', async () => {
    readDoclingDocument.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          schema_name: 'DoclingDocument',
          name: 'Malformed document',
          body: { self_ref: '#/body', children: 'not-an-array' },
        }),
      ),
    );

    await expect(
      job.process({
        sourceId,
        analysisUnit: { index: 0, documentUnitRefs: ['r142', 'r143'] },
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(parse).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(ZodError) },
    );
  });

  it('skips a source that was deleted after the flow was queued', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      job.process({
        sourceId,
        analysisUnit: { index: 0, documentUnitRefs: ['r142', 'r143'] },
      }),
    ).resolves.toEqual({ boundaries: [] });

    expect(parse).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });
});

describe('boundary detection input', () => {
  it('preserves reading-order units and safely escapes XML content', () => {
    const document = parseAnalysisDocument(
      createTestDoclingDocument('Escaping', [
        {
          label: 'paragraph',
          self_ref: 'r&1',
          text: '<unit> & "quoted"',
        },
      ]),
    );

    const documentUnits = indexDocumentUnits(document);
    const escapedUnit = documentUnits.get('r&1');
    expect(escapedUnit).toBeDefined();
    if (!escapedUnit) {
      throw new Error('Expected escaped document unit');
    }
    const serialized = serializeDocumentUnits([escapedUnit]);

    expect(serialized).toContain('ref="r&amp;1"');
    expect(serialized).toContain('&lt;unit&gt; &amp; &quot;quoted&quot;');
  });

  it('serializes SDK table cells and picture descriptions without local unit types', () => {
    const document = parseAnalysisDocument(
      createTestDoclingDocument('Rich content', [
        {
          label: 'table',
          self_ref: 'table-ref',
          data: [
            [{ text: 'Algorithm' }, { text: 'Runtime' }],
            [{ text: 'Dijkstra' }, { text: 'O(E log V)' }],
          ],
        },
        {
          label: 'picture',
          self_ref: 'picture-ref',
          annotations: [
            {
              kind: 'description',
              description: 'A graph with weighted directed edges.',
            },
          ],
        },
      ]),
    );
    const units = indexDocumentUnits(document);
    const tableUnit = units.get('table-ref');
    const pictureUnit = units.get('picture-ref');
    expect(tableUnit).toBeDefined();
    expect(pictureUnit).toBeDefined();
    if (!tableUnit || !pictureUnit) {
      throw new Error('Expected rich document units');
    }

    expect(documentUnitContent(tableUnit)).toBe(
      'Algorithm | Runtime\nDijkstra | O(E log V)',
    );
    expect(documentUnitContent(pictureUnit)).toBe(
      'A graph with weighted directed edges.',
    );
  });

  it('defines pedagogical topics and names presentation changes that are not boundaries', () => {
    const prompt = boundaryDetectionPrompt();

    expect(prompt).toContain('substantially new learning objective');
    expect(prompt).toContain(
      'A new heading is evidence for a possible new topic, not proof of one.',
    );
    for (const falseBoundary of [
      'a new page starts',
      'a heading occurs',
      'an example starts',
      'a proof starts',
      'a formula is introduced',
      'a table appears',
      'the professor asks an exercise',
      'an implementation section begins',
      'a special case is introduced',
    ]) {
      expect(prompt).toContain(falseBoundary);
    }
    expect(prompt).toContain('explicitly allowed to return');
    expect(prompt).toContain('{"boundaries": []}');
  });
});
