import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { UserController } from './user.controller';

@Module({
  imports: [PrismaModule],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
