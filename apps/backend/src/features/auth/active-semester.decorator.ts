import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthenticatedUserRequest } from './authenticated-request';

export const ACTIVE_SEMESTER_REQUIRED_KEY = "auth:active-semester-required";

export const RequireActiveSemester = () =>
  SetMetadata(ACTIVE_SEMESTER_REQUIRED_KEY, true);

export const ActiveSemesterId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedUserRequest>();

    return request.currentUser.activeSemesterId!;
  },
);
