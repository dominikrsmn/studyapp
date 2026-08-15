import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Env } from '../config/env.schema';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  private readonly trustedOrigin: string;

  constructor(config: ConfigService<Env, true>) {
    this.trustedOrigin = new URL(config.get('WEB_URL', { infer: true })).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== this.trustedOrigin) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
