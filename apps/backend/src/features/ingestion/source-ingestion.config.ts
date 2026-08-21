import { registerAs } from '@nestjs/config';

export const sourceIngestionConfig = registerAs('sourceIngestion', () => ({
  queueName: 'source-ingestion',
  jobName: 'ingest-source',
  concurrency: 3,
  attempts: 5,
  backoffDelay: 1_000,
}));
