import { Injectable } from '@nestjs/common';
import type { FindCandidatesJobData } from '../graph-build.types';

@Injectable()
export class FindCandidatesJob {
  async process(data: FindCandidatesJobData): Promise<number> {
    const dimensions = data.embedding.length;
    const distances = [];

    const topic_vector_length = this.calculate_vector_length(data.embedding);

    for (const evidence of data.evidence) {
      let scalar_product = 0;
      const evidence_vector_length = this.calculate_vector_length(
        evidence.embedding,
      );

      for (let i = 0; i < dimensions; i++) {
        scalar_product += evidence.embedding[i] * data.embedding[i];
      }
      const distance =
        1 - scalar_product / (topic_vector_length * evidence_vector_length);
      distances.push(distance);
    }
    return this.nearest_k_evidences(distances, 2);
  }

  private calculate_vector_length(embeddings: number[]): number {
    let sum = 0;
    embeddings.forEach((val) => (sum += val ** 2));
    return Math.sqrt(sum);
  }

  private nearest_k_evidences(distances: number[], k: number): number {
    return (
      distances
        .sort((a, b) => a - b)
        .slice(0, k)
        .reduce((sum, val) => sum + val, 0) / k || 0
    );
  }
}
