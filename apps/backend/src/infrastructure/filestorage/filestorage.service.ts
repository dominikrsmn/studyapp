import { Inject, Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { ConfigType } from '@nestjs/config';
import { fileStorageConfig } from '../config/filestorage.config';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(fileStorageConfig.KEY)
    private readonly config: ConfigType<typeof fileStorageConfig>,
  ) {}

  async save(buffer: Buffer, key: string): Promise<void> {
    await mkdir(this.fileDir(key), { recursive: true });
    await writeFile(this.filePath(key), buffer);
  }

  async read(key: string): Promise<Buffer> {
    return await readFile(this.filePath(key));
  }

  async delete(key: string): Promise<void> {
    await this.deleteMany([key]);
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    await Promise.all(
      keys.map((key) =>
        rm(this.fileDir(key), { recursive: true, force: true }),
      ),
    );
  }

  private fileDir(key: string) {
    return join(this.config.directory, key);
  }

  private filePath(key: string) {
    return join(this.fileDir(key), this.config.originalFileName);
  }
}
