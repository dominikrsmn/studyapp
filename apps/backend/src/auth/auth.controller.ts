import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

const emailSchema = z.object({ email: z.email() });
const tokenSchema = z.object({ token: z.string().min(1) });
const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('magic-link')
  async requestMagicLink(@Body() body: unknown): Promise<void> {
    const input = emailSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(z.treeifyError(input.error));
    }
    await this.authService.requestMagicLink(input.data.email);
  }

  @Public()
  @Get('magic-link/verify')
  verifyMagicLink(@Query('token') token: unknown) {
    const input = tokenSchema.safeParse({ token });
    if (!input.success) {
      throw new BadRequestException(z.treeifyError(input.error));
    }
    return this.authService.verifyMagicLink(input.data.token);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: unknown) {
    const input = refreshTokenSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(z.treeifyError(input.error));
    }
    return this.authService.refresh(input.data.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() body: unknown): Promise<void> {
    const input = refreshTokenSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(z.treeifyError(input.error));
    }
    await this.authService.logout(input.data.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('protected')
  protectedRoute() {
    return { message: 'You have access to this protected route.' };
  }
}
