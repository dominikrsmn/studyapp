import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { AuthenticatedUserRequest } from './authenticated-request';

export const ACTIVE_SEMESTER_REQUIRED_KEY = 'auth:active-semester-required';

type ActiveSemesterRequest = AuthenticatedUserRequest & {
  currentUser: AuthenticatedUserRequest['currentUser'] & {
    activeSemesterId: string;
  };
};

export const RequireActiveSemester = () =>
  SetMetadata(ACTIVE_SEMESTER_REQUIRED_KEY, true);

export const ActiveSemesterId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<ActiveSemesterRequest>();

    return request.currentUser.activeSemesterId;
  },
);
