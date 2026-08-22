import { Inject, Injectable } from '@nestjs/common';
import {
  AnalysisChunk,
  TopicCandidate,
  topicCandidatesSchema,
} from '../topic.types';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import { topicAnalysisConfig } from '../topic-analysis.config';
import { ConfigType } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';
import { escapeXml } from '../topic-xml.utils';

@Injectable()
export class TopicCandidateExtractionService {
  constructor(
    private readonly openAiService: OpenAiService,
    @Inject(topicAnalysisConfig.KEY)
    private readonly topicAnalysisConfiguration: ConfigType<
      typeof topicAnalysisConfig
    >,
  ) {}

  async extract(chunks: AnalysisChunk[]): Promise<TopicCandidate[]> {
    const batchSize = this.topicAnalysisConfiguration.extraction.batchSize;

    const batches: AnalysisChunk[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map(async (batch) => this.processBatch(batch)),
    );

    return results.flat();
  }

  private async processBatch(batch: AnalysisChunk[]) {
    const response = await this.openAiService.client.responses.parse({
      model: this.topicAnalysisConfiguration.extraction.model,
      input: [
        {
          role: 'developer',
          content: `
              You extract topic candidates from batches of university study material.

              Your task is to identify the distinct academic topics discussed in the provided analysis chunks and capture the information that each chunk contributes to those topics.

              The input contains multiple \`<chunk>\` elements. Each chunk includes:

              * a globally stable \`id\`
              * stable source and source-page IDs
              * a \`pageNumber\`
              * page-relative character offsets
              * the chunk text

              For each relevant topic you identify, return a topic candidate that contains:

              * a concise canonical topic title
              * a precise description of the information about that topic contained in the provided chunks
              * one or more exact chunk IDs supporting every fact

              ## Extraction rules

              1. Extract only topics that are actually supported by the provided material.
              2. Do not introduce outside knowledge, assumptions, or additional facts.
              3. Prefer meaningful academic concepts over incidental words, examples, headings, or isolated terminology.
              4. Use the level of granularity that would be useful for organizing a university course.
              5. Avoid topics that are too broad when the material discusses a clearly identifiable subtopic.
              6. Avoid topics that are too narrow when they are merely a single example, formula instance, or implementation detail of a broader concept.
              7. If multiple chunks discuss the same topic, return one candidate and combine the relevant information from those chunks.
              8. If two concepts are genuinely distinct, keep them as separate candidates even if they are closely related.
              9. Preserve important definitions, methods, conditions, properties, relationships, and limitations mentioned in the material.
              10. Keep descriptions concise but information-dense. Do not write a general textbook summary of the topic; summarize only what the provided chunks contribute.
              11. Topic titles should be stable and canonical enough that a later consolidation step can compare candidates extracted from other parts of the course.
              12. Do not try to reconcile the extracted candidates with topics from other batches or existing module topics. A later processing step handles global consolidation and reconciliation.
              13. Do not create duplicate candidates within this batch.
              14. If a chunk contains no meaningful academic topic, it may contribute to no candidate.
              15. If the same information appears repeatedly because of overlapping chunks, include it only once in the candidate description.
              16. Copy chunk IDs exactly from the input. Never invent, shorten, or rewrite an ID.
              17. Every returned fact must have at least one supporting chunk ID.

              The output should reflect the topics contained in this batch as faithfully as possible while minimizing duplication and unnecessary fragmentation.

            `,
        },
        {
          role: 'user',
          content: `
              <analysis_chunks>
                ${batch
                  .map(
                    (chunk) => `
                      <chunk id="${escapeXml(chunk.id)}" sourceId="${escapeXml(chunk.sourceId)}" sourcePageId="${escapeXml(chunk.sourcePageId)}" pageNumber="${chunk.pageNumber}" chunkIndex="${chunk.chunkIndex}" startOffset="${chunk.startOffset}" endOffset="${chunk.endOffset}">
                        ${escapeXml(chunk.content)}
                      </chunk>
                    `,
                  )
                  .join('\n')}
              </analysis_chunks>
            `,
        },
      ],
      text: {
        format: zodTextFormat(topicCandidatesSchema, 'topic_candidates'),
      },
    });

    if (!response.output_parsed) {
      throw new Error(
        'Topic extraction response did not contain parsed output',
      );
    }

    const candidates = response.output_parsed.candidates;
    this.assertValidChunkReferences(
      candidates,
      new Set(batch.map(({ id }) => id)),
    );
    return candidates;
  }

  private assertValidChunkReferences(
    candidates: TopicCandidate[],
    allowedChunkIds: Set<string>,
  ): void {
    for (const candidate of candidates) {
      for (const fact of candidate.facts) {
        fact.chunkIds = [...new Set(fact.chunkIds)];
        for (const chunkId of fact.chunkIds) {
          if (!allowedChunkIds.has(chunkId)) {
            throw new Error(
              `Topic extraction returned unknown analysis chunk ID "${chunkId}"`,
            );
          }
        }
      }
    }
  }
}
