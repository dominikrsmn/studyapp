import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../infrastructure/database/generated/client';
import type { AuthenticatedUserRequest } from './authenticated-request';

export const CURRENT_USER_REQUIRED_KEY = 'auth:current-user-required';

const requireCurrentUser: ParameterDecorator = (target, propertyKey) => {
  if (propertyKey === undefined) {
    return;
  }

  const handler = (target as Record<string | symbol, object>)[propertyKey];
  Reflect.defineMetadata(CURRENT_USER_REQUIRED_KEY, true, handler);
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthenticatedUserRequest>().currentUser,
  [requireCurrentUser],
);
