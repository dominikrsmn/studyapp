import { Injectable } from '@nestjs/common';
import { ParseDocumentJobData } from '../ingestion.types';

@Injectable()
export class ParseDocumentJob {
  async process({ sourceId }: ParseDocumentJobData): Promise<void> {
    console.log(`Processing document job: ${sourceId}`);
  }
}
