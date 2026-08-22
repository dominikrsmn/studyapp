import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class TopicAnalysisService {
  constructor(private readonly prismaService: PrismaService) {}

  async analyze(sourceId: string): Promise<void> {
    let moduleId: string | undefined;
    // eslint-disable-next-line no-useless-catch
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
    } catch (error) {
      throw error;
    }
  }
}
