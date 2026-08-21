import { registerAs } from '@nestjs/config';
import { join } from 'node:path';

export const fileStorageConfig = registerAs('fileStorage', () => ({
  directory: join(process.cwd(), 'uploads'),
  originalFileName: 'original.pdf',
}));
