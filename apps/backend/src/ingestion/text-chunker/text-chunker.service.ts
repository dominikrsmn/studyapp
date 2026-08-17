import { Injectable } from '@nestjs/common';

@Injectable()
export class TextChunkerService {
  private CHUNK_SIZE = 1000;
  private CHUNK_OVERLAP = 200;

  chunk(text: string): string[] {
    const chunks: string[] = [];
    for (
      let start = 0;
      start < text.length;
      start += this.CHUNK_SIZE - this.CHUNK_OVERLAP
    ) {
      chunks.push(text.slice(start, start + this.CHUNK_SIZE));
      if (start + this.CHUNK_SIZE >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
