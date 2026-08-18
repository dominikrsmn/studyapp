import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSemester, SemesterDto } from '@study/contracts';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { Semester } from '../../infrastructure/database/generated/client';

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

  async findOne(userId: string, id: string): Promise<SemesterDto> {
    const semester = await this.prisma.semester.findUnique({
      where: { userId, id },
      select: semesterSelect
      });
    if (!semester) {
      throw new NotFoundException(`Semester with id "${id}" was not found`);
    }
    return this.toDto(semester)
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

  async setActiveSemester(userId: string, id: string): Promise<SemesterDto> {
    const semester: Semester | null = await this.prisma.semester.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!semester) {
      throw new NotFoundException(`Semester with id "${id}" was not found`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeSemesterId: id
      }
    })
    return this.toDto(semester)
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
