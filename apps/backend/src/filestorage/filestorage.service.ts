import { Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class FileStorageService {
  async save(buffer: Buffer, key: string): Promise<void> {
    await mkdir(this.fileDir(key), { recursive: true });
    await writeFile(this.filePath(key), buffer);
  }

  async read(key: string): Promise<Buffer> {
    return await readFile(this.filePath(key));
  }

  async delete(key: string): Promise<void> {
    return await unlink(this.filePath(key));
  }

  private fileDir(key: string) {
    return join(process.cwd(), '/uploads/', key);
  }

  private filePath(key: string) {
    return join(this.fileDir(key), '/original.pdf');
  }
}
