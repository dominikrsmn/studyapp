import { Inject, Injectable } from '@nestjs/common';
import { Fact, TopicCandidate, topicCandidatesSchema } from '../topic.types';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import { topicAnalysisConfig } from '../topic-analysis.config';
import { ConfigType } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';
import { escapeXml } from '../topic-xml.utils';

@Injectable()
export class TopicCandidateConsolidationService {
  constructor(
    private readonly openAiService: OpenAiService,
    @Inject(topicAnalysisConfig.KEY)
    private readonly topicAnalysisConfiguration: ConfigType<
      typeof topicAnalysisConfig
    >,
  ) {}

  async consolidate(candidates: TopicCandidate[]): Promise<TopicCandidate[]> {
    const allowedChunkIds = new Set(
      candidates.flatMap((candidate) =>
        candidate.facts.flatMap((fact) => fact.chunkIds),
      ),
    );
    const response = await this.openAiService.client.responses.parse({
      model: this.topicAnalysisConfiguration.consolidation.model,
      input: [
        {
          role: 'developer',
          content: `

          You consolidate topic candidates extracted from different parts of the same source into a coherent, non-redundant set of topic candidates.

          The input contains multiple \`<candidate>\` elements. Each candidate includes:

          * an \`index\`
          * a topic \`title\`
          * a \`description\`
          * a list of \`facts\`
          * the chunk IDs supporting each fact

          The candidates were extracted independently from different analysis chunks. As a result, multiple candidates may refer to the same underlying academic topic using different titles, descriptions, or levels of specificity.

          Your task is to identify such overlaps and consolidate them.

          ## Consolidation rules

          1. Merge candidates only when they represent the same underlying academic topic.

          2. Do not merge topics merely because they are related. Closely related but conceptually distinct topics must remain separate.

          3. Prefer concise, canonical academic topic titles that would be suitable for organizing a university course.

          4. When merging candidates, create a description that accurately represents the combined scope of the merged candidates.

          5. Preserve all relevant factual information from the input candidates.

          6. Remove factual duplicates and near-duplicates when they communicate the same information.

          7. When equivalent facts are merged, preserve the union of all chunk IDs that support that information.

          8. Never invent new facts, explanations, relationships, or supporting chunk IDs.

          9. Do not use outside knowledge. Consolidate only based on the provided candidates.

          10. Preserve provenance. Every fact in the output must be traceable to one or more chunk IDs from the input.

          11. Avoid unnecessary fragmentation. If several candidates are simply different formulations of the same topic, consolidate them.

          12. Avoid excessive generalization. Do not merge distinct subtopics into a broad parent topic solely to reduce the number of candidates.

          13. Do not reconcile candidates with existing module topics. This step only consolidates candidates extracted from the current source. A later processing step handles reconciliation with persisted module topics.

          14. Do not decide whether a topic should be accepted, rejected, or confirmed by the user.

          15. If a candidate is already distinct and coherent, preserve it without unnecessary rewriting.

          The resulting set should contain the smallest reasonable number of topic candidates while preserving meaningful academic distinctions and all supported information.
          `,
        },
        {
          role: 'user',
          content: `
              <topic_candidates>
                ${candidates
                  .map(
                    (candidate: TopicCandidate, index) => `
                      <candidate index="${index}">
                        <title>${escapeXml(candidate.title)}</title>
                        <description>${escapeXml(candidate.description)}</description>
                        <facts>
                          ${candidate.facts
                            .map(
                              (fact: Fact) => `
                            <fact chunkIds="${escapeXml(fact.chunkIds.join(','))}">
                              ${escapeXml(fact.content)}
                            </fact>
                          `,
                            )
                            .join('\n')}
                        </facts>
                      </candidate>
                    `,
                  )
                  .join('\n')}
              </topic_candidates>
            `,
        },
      ],
      text: {
        format: zodTextFormat(topicCandidatesSchema, 'topic_candidates'),
      },
    });

    if (!response.output_parsed) {
      throw new Error(
        'Topic consolidation response did not contain parsed output',
      );
    }

    const consolidatedCandidates = response.output_parsed.candidates;
    for (const candidate of consolidatedCandidates) {
      for (const fact of candidate.facts) {
        fact.chunkIds = [...new Set(fact.chunkIds)];
        for (const chunkId of fact.chunkIds) {
          if (!allowedChunkIds.has(chunkId)) {
            throw new Error(
              `Topic consolidation returned unknown analysis chunk ID "${chunkId}"`,
            );
          }
        }
      }
    }

    return consolidatedCandidates;
  }
}
