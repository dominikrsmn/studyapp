import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';

type TopicCandidate = {
  title: string;
  description: string;
  facts: Fact[];
};

type Fact = {
  content: string;
  chunkIds: string[];
};
@Injectable()
export class TopicAnalysisService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly textProcessingService: TextProcessingService,
  ) {}

  async analyze(sourceId: string): Promise<void> {
    let moduleId: string | undefined;
    try {
      const source = await this.prismaService.source.findFirst({
        where: {
          id: sourceId,
        },
        select: {
          module: {
            select: {
              id: true,
              semester: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });
      if (!source) {
        throw new NotFoundException(`Source was not found`);
      }

      moduleId = source.module.id;
      const analysisChunks =
        await this.textProcessingService.chunkForAnalysis(moduleId);
    } catch (error) {
      throw error;
    }
  }
}
