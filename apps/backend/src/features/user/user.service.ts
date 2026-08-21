import { Injectable } from '@nestjs/common';
import type { User } from '../../infrastructure/database/generated/client';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findOrCreateByEmail(email: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { email },
      create: { email },
      update: {},
    });
  }
}
