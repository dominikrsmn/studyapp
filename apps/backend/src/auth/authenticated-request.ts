import type { Request } from 'express';
import type { User } from '../database/generated/client';

declare module 'express' {
  interface Request {
    userId?: string;
    sessionId?: string;
    currentUser?: User;
  }
}

export interface AuthenticatedUserRequest extends AuthenticatedRequest {
  currentUser: User;
}

export interface AuthenticatedRequest extends Request {
  userId: string;
  sessionId: string;
}
