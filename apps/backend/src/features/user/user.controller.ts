import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../../infrastructure/database/generated/client';
import { UserDto } from '@study/contracts';

@Controller('user')
export class UserController {

  @Get('me')
  getMe(@CurrentUser() user: User): UserDto {
    return this.toDto(user);
  }

  private toDto(user: User): UserDto {
    return {
      email: user.email,
      id: user.id,
      name: user.name,
      activeSemesterId: user.activeSemesterId,
    };
  }
}
