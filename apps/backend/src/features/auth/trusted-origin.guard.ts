import type {
  CanActivate,
  ExecutionContext} from '@nestjs/common';
import {
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { authConfig } from './auth.config';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  private readonly trustedOrigin: string;

  constructor(@Inject(authConfig.KEY) config: ConfigType<typeof authConfig>) {
    this.trustedOrigin = new URL(config.webUrl).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== this.trustedOrigin) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
