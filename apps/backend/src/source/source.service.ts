import { Injectable, NotFoundException } from '@nestjs/common';
import { SourceDto } from '@study/contracts';
import { PrismaService } from '../database/prisma/prisma.service';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

@Injectable()
export class SourceService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadSource(
    userId: string,
    moduleId: string,
    source: Express.Multer.File,
  ): Promise<SourceDto> {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, userId },
      select: { id: true },
    });

    if (!module) {
      throw new NotFoundException(`Module with id "${moduleId}" was not found`);
    }
    const uploadedMetadata = await this.prisma.source.create({
      data: {
        name: source.originalname,
        type: 'DOCUMENT',
        mimeType: source.mimetype,
        moduleId: moduleId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        mimeType: true,
        status: true,
        moduleId: true,
      },
    });

    const uploadDir = join(process.cwd() + '/uploads');
    const filePath = join(uploadDir, source.originalname);

    await writeFile(filePath, source.buffer);

    return uploadedMetadata;
  }
}
