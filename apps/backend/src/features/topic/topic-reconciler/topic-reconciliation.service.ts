import { Inject, Injectable } from '@nestjs/common';
import {
  Fact,
  ModuleTopic,
  TopicCandidate,
  TopicReconciliation,
  topicReconciliationSchema,
} from '../topic.types';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import { topicAnalysisConfig } from '../topic-analysis.config';
import { ConfigType } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';

@Injectable()
export class TopicReconciliationService {
  constructor(
    private readonly openAiService: OpenAiService,
    @Inject(topicAnalysisConfig.KEY)
    private readonly topicAnalysisConfiguration: ConfigType<
      typeof topicAnalysisConfig
    >,
  ) {}

  async reconcile(
    candidates: TopicCandidate[],
    topics: ModuleTopic[],
  ): Promise<TopicReconciliation> {
    const response = await this.openAiService.client.responses.parse({
      model: this.topicAnalysisConfiguration.reconciliation.model,
      input: [
        {
          role: 'developer',
          content: `
            You are responsible for reconciling newly extracted topic candidates with the existing topics of a university course module.

            Your task is to produce a canonical mapping between the provided topic candidates and the module's existing topics.

            You must determine:

            1. Which topic candidates represent an already existing topic.
            2. Which topic candidates describe the same new topic and should be consolidated into one new topic.

            Do not summarize the course material and do not rewrite or reproduce evidence. Evidence and provenance are preserved outside this reconciliation step through the candidate indexes.

            ## Input

            You receive two collections.

            ### Existing topics

            \`<existing_topics>\` contains the topics that already exist in the module.

            Each topic has:

            * \`id\`: the stable identifier of the existing topic
            * \`title\`: the canonical topic title
            * \`description\`: the intended semantic scope of the topic
            * optionally \`summary\`: a synthesized description based on previously analyzed material
            * \`full_evidence\`: previously extracted evidence associated with the topic

            Use the title, description, summary, and evidence together when determining the semantic scope of an existing topic.

            Do not match based on title similarity alone.

            ### Topic candidates

            \`<topic_candidates>\` contains topics extracted from newly analyzed source material.

            Each candidate has:

            * \`index\`: its stable index within the provided candidate list
            * \`title\`
            * \`description\`
            * \`facts\`: factual information supporting the candidate

            Facts may contain provenance metadata such as chunk IDs. Use the facts to understand the candidate, but do not reproduce or modify them in your output.

            ## Reconciliation

            Every topic candidate must be assigned to exactly one canonical topic.

            A candidate must either:

            * match exactly one existing topic, or
            * contribute to exactly one newly created topic.

            Never assign one candidate to multiple topics.

            Never omit a candidate.

            ### Matching existing topics

            Match a candidate to an existing topic when both describe substantially the same learnable concept.

            Use semantic meaning rather than exact terminology.

            For example, these may represent the same topic:

            * \`Partial Fractions\`
            * \`Partial Fraction Decomposition\`
            * \`Decomposition into Partial Fractions\`

            When multiple candidates match the same existing topic, return a single \`existingTopicMatches\` entry for that topic containing all matching candidate indexes.

            Do not create a new topic when an existing topic already adequately represents the concept.

            ### Do not over-merge

            Related topics are not necessarily the same topic.

            Preserve distinctions that are useful for learning, practice, and assessing student understanding.

            For example:

            * \`Integration\` and \`Integration by Parts\` should normally remain distinct.
            * \`Probability Distributions\` and \`Poisson Distribution\` should normally remain distinct.
            * \`Sequences\` and \`Convergence of Sequences\` may remain distinct if the provided material treats convergence as an independently meaningful concept.

            Do not merge a specific concept into a broader topic merely because they are related.

            Conversely, do not create separate topics merely because different terminology is used for the same underlying concept.

            ## Creating new topics

            If no existing topic adequately represents a candidate, it must contribute to a new topic.

            Multiple candidates may be consolidated into one new topic when they describe the same underlying concept.

            For every new topic:

            * create a concise and academically appropriate \`title\`
            * create a precise \`description\` defining the scope of the topic
            * include all candidate indexes that contributed to it

            The description should identify what the topic covers and distinguish it from closely related topics.

            Do not add concepts or factual claims that are not supported by the provided candidates.

            Do not create unnecessary umbrella topics solely to group otherwise distinct candidates.

            ## Provenance

            Candidate indexes are the authoritative link back to the original extracted facts and their provenance.

            Therefore:

            * never generate new evidence
            * never rewrite evidence
            * never return facts
            * never return chunk IDs
            * never fabricate provenance
            * never replace candidate indexes with reconstructed content

            Your responsibility is only to decide topic identity and candidate grouping.

            ## Completeness and consistency

            Before producing the result, ensure that:

            * every provided candidate index appears exactly once
            * no candidate index appears in both \`existingTopicMatches\` and \`newTopics\`
            * no candidate index appears in more than one entry
            * every \`topicId\` refers to an ID from \`<existing_topics>\`
            * the same existing topic is not returned in multiple separate match entries
            * every new topic contains at least one candidate
            * semantically equivalent new candidates are consolidated rather than duplicated

            If there are no existing topics, reconcile the candidates only against each other and return all resulting canonical topics under \`newTopics\`.

            If there are no topic candidates, return empty arrays for both output fields.

            ## Output

            Return only the structured reconciliation result matching the provided output schema.

            The output consists of:

            * \`existingTopicMatches\`: mappings from existing topic IDs to candidate indexes
            * \`newTopics\`: newly identified canonical topics and the candidate indexes supporting them

            Do not include explanations, reasoning, evidence, or additional fields in the output.


          `,
        },
        {
          role: 'user',
          content: `
              <existing_topics>
                ${topics
                  .map(
                    (topic: ModuleTopic) => `
                     <topic id="${topic.id}">
                      <title>${this.escapeXml(topic.title)}</title>
                      <description>${this.escapeXml(topic.description)}</description>
                      ${topic.summary && `<summary>${this.escapeXml(topic.summary)}</summary>`}
                      <full_evidence>
                        ${topic.evidence
                          .map(
                            (evidence) => `
                          <evidence id="${evidence.id}">
                            ${this.escapeXml(evidence.content)}
                          </evidence>
                        `,
                          )
                          .join('\n')}
                      </full_evidence>

                     </topic>
                    `,
                  )
                  .join('\n')}
              </existing_topics>
              <topic_candidates>
                ${candidates
                  .map(
                    (candidate: TopicCandidate, index) => `
                      <candidate index="${index}">
                        <title>${this.escapeXml(candidate.title)}</title>
                        <description>${this.escapeXml(candidate.description)}</description>
                        <facts>
                          ${candidate.facts
                            .map(
                              (fact: Fact) => `
                            <fact chunkIds="${fact.chunkIds.join(',')}">
                              ${this.escapeXml(fact.content)}
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
        format: zodTextFormat(topicReconciliationSchema, 'topics'),
      },
    });

    if (!response.output_parsed) {
      throw new Error('Topic reconciliation returned no parsed output');
    }

    return response.output_parsed;
  }

  private escapeXml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
}
