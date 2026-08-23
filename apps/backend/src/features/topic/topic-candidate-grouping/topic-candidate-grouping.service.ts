import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Fact,
  TopicCandidate,
  TopicCandidateConsolidation,
  topicCandidateConsolidationSchema,
} from '../topic.types';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import { topicAnalysisConfig } from '../topic-analysis.config';
import { ConfigType } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';
import { escapeXml } from '../topic-xml.utils';

@Injectable()
export class TopicCandidateGroupingService {
  private readonly logger = new Logger(TopicCandidateGroupingService.name);

  constructor(
    private readonly openAiService: OpenAiService,
    @Inject(topicAnalysisConfig.KEY)
    private readonly topicAnalysisConfiguration: ConfigType<
      typeof topicAnalysisConfig
    >,
  ) {}

  async group(candidates: TopicCandidate[]): Promise<TopicCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }

    const response = await this.openAiService.client.responses.parse({
      model: this.topicAnalysisConfiguration.grouping.model,
      input: [
        {
          role: 'developer',
          content: `

          You group topic candidates extracted from different parts of the same source into a coherent, non-redundant set of academic topics.

          The input contains multiple \`<candidate>\` elements. Each candidate includes:

          * a stable \`index\` within this request
          * a topic \`title\`
          * a \`description\`
          * a list of immutable evidence \`facts\`

          The candidates were extracted independently from different analysis chunks. As a result, multiple candidates may refer to the same underlying academic topic using different titles, descriptions, or levels of specificity.

          Your task is only to decide which candidate indexes belong together and to provide the resulting title and description for each group. Application code will copy all original facts and provenance into the result. Do not return facts or provenance.

          ## Consolidation rules

          1. Group candidates when they are semantic duplicates, or when they are distinct but sufficiently closely related subtopics that they form one coherent and useful academic topic under a shared title.

          2. Do not group candidates merely because they belong to the same broad subject area. The resulting topic must remain specific and useful for organizing university course material.

          3. Do not group candidates whose facts are contradictory or mutually incompatible.

          4. Prefer concise, canonical academic topic titles. When grouping multiple candidates, create a broader or clearer title when appropriate.

          5. Create a precise description of the combined topic using only the scope supported by the grouped candidates.

          6. Keep a distinct, coherent candidate in its own single-index group. Preserve its title and description unless a clearer canonical formulation is genuinely useful.

          7. Do not use outside knowledge or add unsupported concepts, facts, explanations, or relationships to a title or description.

          ## Immutable evidence

          Facts are included only so you can judge semantic compatibility and topic scope. They are immutable evidence.

          * Never rewrite or rephrase fact content.
          * Never merge or deduplicate facts.
          * Never invent, remove, or return facts.
          * Never modify or return provenance or chunk IDs.
          * Never try to reconstruct a fact from its text.

          Candidate indexes are the only references the application will use to carry the original evidence into the result.

          ## Completeness and consistency

          * Every provided candidate index must appear exactly once across all groups.
          * Never omit, duplicate, or invent a candidate index.
          * Each group must contain at least one candidate index.
          * Do not create duplicate groups for the same resulting topic.
          * Do not match candidates with existing module topics. A later merging step handles that.
          * Do not decide whether a topic should be accepted, rejected, or confirmed by the user.

          ## Output

          Return only the structured grouping result. Each group contains a resulting \`title\`, \`description\`, and the \`candidateIndexes\` assigned to it. Do not include reasoning, facts, chunk IDs, or additional fields.
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
                            <fact>${escapeXml(fact.content)}</fact>
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
        format: zodTextFormat(
          topicCandidateConsolidationSchema,
          'topic_candidate_grouping',
        ),
      },
    });

    if (!response.output_parsed) {
      const output = response.output ?? [];
      const refusals = output
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content)
        .filter((item) => item.type === 'refusal')
        .map((item) => item.refusal);
      const details = {
        responseId: response.id,
        status: response.status,
        incompleteReason: response.incomplete_details?.reason,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
        outputTypes: output.map((item) => item.type),
        refusals,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        reasoningTokens: response.usage?.output_tokens_details.reasoning_tokens,
      };

      this.logger.error(
        `Topic grouping response did not contain parsed output: ${JSON.stringify(details)}`,
      );
      throw new Error(
        `Topic grouping response did not contain parsed output (responseId="${response.id}", status="${response.status ?? 'unknown'}", incompleteReason="${response.incomplete_details?.reason ?? 'none'}")`,
      );
    }

    return this.reconstructCandidates(candidates, response.output_parsed);
  }

  private reconstructCandidates(
    candidates: TopicCandidate[],
    grouping: TopicCandidateConsolidation,
  ): TopicCandidate[] {
    const referencedIndexes = new Set<number>();
    const groups = grouping.groups.map((group) => {
      const candidateIndexes = [...group.candidateIndexes].sort(
        (left, right) => left - right,
      );

      for (const candidateIndex of candidateIndexes) {
        if (
          !Number.isInteger(candidateIndex) ||
          candidateIndex < 0 ||
          candidateIndex >= candidates.length
        ) {
          throw new Error(
            `Topic grouping returned unknown candidate index "${candidateIndex}"`,
          );
        }

        if (referencedIndexes.has(candidateIndex)) {
          throw new Error(
            `Topic grouping returned candidate index "${candidateIndex}" more than once`,
          );
        }

        referencedIndexes.add(candidateIndex);
      }

      return { ...group, candidateIndexes };
    });

    const missingIndexes = candidates
      .map((_, index) => index)
      .filter((index) => !referencedIndexes.has(index));

    if (missingIndexes.length > 0) {
      throw new Error(
        `Topic grouping omitted candidate indexes: ${missingIndexes.join(', ')}`,
      );
    }

    return groups
      .sort(
        (left, right) => left.candidateIndexes[0] - right.candidateIndexes[0],
      )
      .map(({ title, description, candidateIndexes }) => ({
        title,
        description,
        facts: candidateIndexes.flatMap(
          (candidateIndex) => candidates[candidateIndex].facts,
        ),
      }));
  }
}
