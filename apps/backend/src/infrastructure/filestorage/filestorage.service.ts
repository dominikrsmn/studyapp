import { Inject, Injectable } from '@nestjs/common';
import { access, mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
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

  async saveDoclingDocument(key: string, document: Buffer): Promise<void> {
    await mkdir(this.fileDir(key), { recursive: true });

    const path = this.doclingDocumentPath(key);
    const temporaryPath = `${path}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporaryPath, document);
      await rename(temporaryPath, path);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  async readDoclingDocument(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.doclingDocumentPath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async hasDoclingDocument(key: string): Promise<boolean> {
    try {
      await access(this.doclingDocumentPath(key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return false;
      }

      throw error;
    }
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

  getSourcePath(sourceId: string) {
    return this.filePath(sourceId);
  }

  private fileDir(key: string) {
    return join(this.config.directory, key);
  }

  private filePath(key: string) {
    return join(this.fileDir(key), this.config.originalFileName);
  }

  private doclingDocumentPath(key: string) {
    return join(this.fileDir(key), this.config.doclingDocumentFileName);
  }
}
