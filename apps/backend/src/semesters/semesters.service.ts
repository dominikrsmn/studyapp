import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSemester, SemesterDto } from '@study/contracts';
import { PrismaService } from '../database/prisma/prisma.service';

const semesterSelect = { id: true, startDate: true, endDate: true } as const;

@Injectable()
export class SemestersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateSemester): Promise<SemesterDto> {
    const semester = await this.prisma.semester.create({
      data: {
        userId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      },
      select: semesterSelect,
    });
    return this.toDto(semester);
  }

  async findAll(userId: string): Promise<SemesterDto[]> {
    const semesters = await this.prisma.semester.findMany({
      where: { userId },
      select: semesterSelect,
      orderBy: { startDate: 'desc' },
    });
    return semesters.map((semester) => this.toDto(semester));
  }

  async remove(userId: string, id: string): Promise<SemesterDto> {
    const semester = await this.prisma.semester.findFirst({
      where: { id, userId },
      select: semesterSelect,
    });
    if (!semester) {
      throw new NotFoundException(`Semester with id "${id}" was not found`);
    }
    await this.prisma.semester.delete({ where: { id } });
    return this.toDto(semester);
  }

  private toDto(semester: {
    id: string;
    startDate: Date;
    endDate: Date;
  }): SemesterDto {
    return {
      id: semester.id,
      startDate: semester.startDate.toISOString(),
      endDate: semester.endDate.toISOString(),
    };
  }
}
