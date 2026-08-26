import { Logger } from '@nestjs/common';
import { embeddingConfig } from '../../../../infrastructure/config/embedding.config';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { DoclingService } from '../../../../infrastructure/docling/docling.service';
import { ingestionConfig } from '../ingestion.config';
import { IngestionQueue } from '../ingestion.queue';
import { SourceProcessingStageService } from '../source-processing-stage.service';
import { BuildRagChunksJob } from './build-rag-chunks.job';

jest.mock('../../../../infrastructure/docling/docling.service', () => ({
  DoclingService: class DoclingService {},
}));
jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('BuildRagChunksJob', () => {
  const sourceId = 'source-id';
  const source = { document: { schema_name: 'DoclingDocument' } };
  const sourceDelegate = { findUnique: jest.fn() };
  const sourceChunkDelegate = {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };
  const transaction = { sourceChunk: sourceChunkDelegate };
  const prismaService = {
    source: sourceDelegate,
    $transaction: jest.fn(),
  };
  const chunk = jest.fn();
  const doclingService = {
    client: { chunk },
  };
  const ingestionQueue = { addRagEmbeddingFlow: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };
  const config = ingestionConfig();
  const embedding = { ...embeddingConfig(), batchSize: 2 };

  let job: BuildRagChunksJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue(source);
    sourceChunkDelegate.upsert.mockImplementation(({ create }) =>
      Promise.resolve({
        id: `chunk-${create.chunkIndex}`,
        chunkIndex: create.chunkIndex,
      }),
    );
    sourceChunkDelegate.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });
    ingestionQueue.addRagEmbeddingFlow.mockResolvedValue(undefined);
    chunk.mockResolvedValue({
      chunks: [
        {
          filename: 'source.json',
          chunk_index: 2,
          text: 'Section C\n\nContextualized content C',
          raw_text: 'Contextualized content C',
          num_tokens: 13,
          headings: ['Section C'],
          captions: null,
          doc_items: ['#/texts/4'],
          page_numbers: [4],
        },
        {
          filename: 'source.json',
          chunk_index: 0,
          text: 'Section A\n\nContextualized content A',
          raw_text: 'Contextualized content A',
          num_tokens: 11,
          headings: ['Part 1', 'Section A'],
          captions: null,
          doc_items: ['#/texts/0', '#/texts/1'],
          page_numbers: [2, 1],
        },
        {
          filename: 'source.json',
          chunk_index: 1,
          text: 'Contextualized content B',
          raw_text: 'Contextualized content B',
          num_tokens: 7,
          headings: null,
          captions: null,
          doc_items: ['#/tables/0'],
          page_numbers: null,
        },
      ],
      documents: [],
      processing_time: 0.1,
    });

    job = new BuildRagChunksJob(
      doclingService as unknown as DoclingService,
      prismaService as unknown as PrismaService,
      ingestionQueue as unknown as IngestionQueue,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
      config,
      embedding,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses HybridChunker and persists contextualized chunks in reading order', async () => {
    await job.process({ sourceId });

    expect(sourceProcessingStageService.transition).toHaveBeenNthCalledWith(
      1,
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.PROCESSING,
    );
    expect(chunk).toHaveBeenCalledWith(
      {
        data: Buffer.from(JSON.stringify(source.document)),
        filename: `${sourceId}.json`,
        contentType: 'application/json',
      },
      {
        chunker: 'hybrid',
        convert_options: {
          from_formats: ['json_docling'],
          abort_on_error: true,
        },
        chunking_options: {
          include_raw_text: true,
          max_tokens: config.rag.chunking.maxTokens,
          tokenizer: config.rag.chunking.tokenizer,
          merge_peers: config.rag.chunking.mergePeers,
          use_markdown_tables: config.rag.chunking.useMarkdownTables,
        },
      },
    );
    expect(sourceChunkDelegate.upsert).toHaveBeenNthCalledWith(1, {
      where: { sourceId_chunkIndex: { sourceId, chunkIndex: 0 } },
      create: {
        sourceId,
        chunkIndex: 0,
        content: 'Section A\n\nContextualized content A',
        headingPath: ['Part 1', 'Section A'],
        pageStart: 1,
        pageEnd: 2,
        startRef: '#/texts/0',
        endRef: '#/texts/1',
        tokenCount: 11,
      },
      update: {
        chunkIndex: 0,
        content: 'Section A\n\nContextualized content A',
        headingPath: ['Part 1', 'Section A'],
        pageStart: 1,
        pageEnd: 2,
        startRef: '#/texts/0',
        endRef: '#/texts/1',
        tokenCount: 11,
      },
      select: { id: true, chunkIndex: true },
    });
    expect(sourceChunkDelegate.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          chunkIndex: 1,
          content: 'Contextualized content B',
          headingPath: [],
          pageStart: null,
          pageEnd: null,
        }),
      }),
    );
    expect(sourceChunkDelegate.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        create: expect.objectContaining({ chunkIndex: 2 }),
      }),
    );
    expect(sourceChunkDelegate.deleteMany).toHaveBeenCalledWith({
      where: { sourceId, chunkIndex: { gte: 3 } },
    });
  });

  it('commits all chunks before enqueueing one flow with provider-sized embedding batches', async () => {
    await job.process({ sourceId });

    expect(ingestionQueue.addRagEmbeddingFlow).toHaveBeenCalledTimes(1);
    expect(ingestionQueue.addRagEmbeddingFlow).toHaveBeenCalledWith(sourceId, [
      ['chunk-0', 'chunk-1'],
      ['chunk-2'],
    ]);
    expect(
      sourceChunkDelegate.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      ingestionQueue.addRagEmbeddingFlow.mock.invocationCallOrder[0],
    );
  });

  it('skips deleted sources without changing indexing state', async () => {
    sourceDelegate.findUnique.mockResolvedValue(null);

    await job.process({ sourceId });

    expect(sourceProcessingStageService.transition).not.toHaveBeenCalled();
    expect(chunk).not.toHaveBeenCalled();
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it('records RAG indexing failures and rethrows for retry handling', async () => {
    const chunkingError = new Error('Docling chunking failed');
    chunk.mockRejectedValue(chunkingError);

    await expect(job.process({ sourceId })).rejects.toBe(chunkingError);

    expect(sourceProcessingStageService.transition).toHaveBeenLastCalledWith(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.FAILED,
      { error: chunkingError },
    );
    expect(ingestionQueue.addRagEmbeddingFlow).not.toHaveBeenCalled();
  });

  it('does not enqueue embedding jobs when chunk persistence fails', async () => {
    const persistenceError = new Error('Database failed');
    prismaService.$transaction.mockRejectedValue(persistenceError);

    await expect(job.process({ sourceId })).rejects.toBe(persistenceError);

    expect(ingestionQueue.addRagEmbeddingFlow).not.toHaveBeenCalled();
  });
});
