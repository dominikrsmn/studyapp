import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common/exceptions';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AccessTokenPayload } from './auth.types';
import { UserService } from '../user/user.service';
import { CURRENT_USER_REQUIRED_KEY } from './current-user.decorator';
import { ACTIVE_SEMESTER_REQUIRED_KEY } from './active-semester.decorator';
import { ConfigType } from '@nestjs/config';
import { authConfig } from './auth.config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private reflector: Reflector,
    private readonly usersService: UserService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          audience: this.config.audiences.access,
          issuer: this.config.issuer,
        },
      );
      if (
        payload.type !== 'access' ||
        !payload.sub ||
        !payload.sessionId ||
        !payload.email
      ) {
        throw new UnauthorizedException('Invalid token');
      }
      request.userId = payload.sub;
      request.sessionId = payload.sessionId;

      const shouldLoadCurrentUser = this.reflector.getAllAndOverride<boolean>(
        CURRENT_USER_REQUIRED_KEY,
        [context.getHandler(), context.getClass()],
      );

      const activeSemesterRequired = this.reflector.getAllAndOverride<boolean>(
        ACTIVE_SEMESTER_REQUIRED_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (shouldLoadCurrentUser || activeSemesterRequired) {
        const user = await this.usersService.findOne(payload.sub);
        if (!user) {
          throw new UnauthorizedException(
            'Authenticated user no longer exists',
          );
        }
        if (activeSemesterRequired && !user.activeSemesterId) {
          throw new ConflictException('No active semester is set');
        }
        request.currentUser = user;
      }
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
