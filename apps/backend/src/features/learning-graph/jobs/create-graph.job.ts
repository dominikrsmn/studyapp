import { Injectable } from '@nestjs/common';
import type { CreateGraphJobData } from '../graph-build.types';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class CreateGraphJob {
  constructor(private readonly prismaService: PrismaService) {}

  async process(data: CreateGraphJobData): Promise<void> {
    const graph = await this.prismaService.learningGraph.findUnique({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: data.graphVersion,
        module: { graphVersion: data.graphVersion },
      },
      select: { id: true },
    });
    if (!graph) return;
  }
}
