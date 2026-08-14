import { AuthGuard } from './auth.guard';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login() {
    // authService login
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('protected')
  protectedRoute() {
    return { message: 'You have access to this protected route.' };
  }
}
