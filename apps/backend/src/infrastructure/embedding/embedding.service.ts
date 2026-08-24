import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingService {
  async embedQuery(query: string, userId: string): Promise<string[]> {
    return [];
  }
}
