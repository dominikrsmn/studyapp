import { Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class FileStorageService {
  private UPLOAD_DIR: string = join(process.cwd + '/uploads');

  async save(buffer: Buffer, key: string): Promise<void> {
    await mkdir(this.UPLOAD_DIR, { recursive: true });
    await writeFile(join(this.UPLOAD_DIR, '/', key, '/original.pdf'), buffer);
  }

  async read(key: string): Promise<Buffer> {
    return await readFile(join(this.UPLOAD_DIR, '/', key, '/original.pdf'));
  }

  async delete(key: string): Promise<void> {
    return await unlink(join(join(this.UPLOAD_DIR, '/', key, '/original.pdf')));
  }
}
