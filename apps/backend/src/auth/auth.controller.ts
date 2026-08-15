import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Env } from '../config/env.schema';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import {
  clearRefreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
  refreshTokenCookieOptions,
} from './refresh-token.cookie';
import { TrustedOriginGuard } from './trusted-origin.guard';

const emailSchema = z.object({ email: z.email() });
const tokenSchema = z.object({ token: z.string().min(1) });

interface AccessTokenResponse {
  accessToken: string;
}

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.isProduction =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

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
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @Post('magic-link/verify')
  async verifyMagicLink(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    const input = tokenSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(z.treeifyError(input.error));
    }

    const tokens = await this.authService.verifyMagicLink(input.data.token);
    this.setRefreshTokenCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TrustedOriginGuard)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      clearRefreshTokenCookieOptions(this.isProduction),
    );

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('protected')
  protectedRoute() {
    return { message: 'You have access to this protected route.' };
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      refreshTokenCookieOptions(this.isProduction),
    );
  }
}
