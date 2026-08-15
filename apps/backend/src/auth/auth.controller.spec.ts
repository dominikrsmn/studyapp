jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));

import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Env } from '../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './refresh-token.cookie';
import type { AuthenticatedRequest } from './authenticated-request';

describe('AuthController', () => {
  const authService = {
    verifyMagicLink: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    findSessions: jest.fn(),
    revokeUserSession: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('development'),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(
      authService as unknown as AuthService,
      config as unknown as ConfigService<Env, true>,
    );
  });

  it('sets the refresh cookie without returning the refresh token', async () => {
    const refreshTokenExpiresAt = new Date('2026-09-14T12:00:00.000Z');
    authService.verifyMagicLink.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt,
    });
    const response = { cookie: jest.fn() } as unknown as Response;

    await expect(
      controller.verifyMagicLink({ token: 'magic-token' }, response),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    });
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
      }),
    );
  });

  it('reads and rotates the refresh-token cookie', async () => {
    const refreshTokenExpiresAt = new Date('2026-09-14T12:00:00.000Z');
    authService.refresh.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt,
    });
    const request = {
      cookies: { [REFRESH_TOKEN_COOKIE]: 'current-refresh-token' },
    } as unknown as Request;
    const response = { cookie: jest.fn() } as unknown as Response;

    await expect(controller.refresh(request, response)).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    });
    expect(authService.refresh).toHaveBeenCalledWith('current-refresh-token');
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'new-refresh-token',
      expect.any(Object),
    );
  });

  it('revokes the session and clears its refresh cookie on logout', async () => {
    authService.logout.mockResolvedValue(undefined);
    const request = {
      cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-token' },
    } as unknown as Request;
    const response = { clearCookie: jest.fn() } as unknown as Response;

    await controller.logout(request, response);

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: '/api/auth' }),
    );
  });

  it('clears the refresh cookie when revoking the current session', async () => {
    authService.revokeUserSession.mockResolvedValue(undefined);
    const currentSessionId = 'e86db06e-1386-48c6-9b6b-b9d568607091';
    const response = { clearCookie: jest.fn() } as unknown as Response;

    await controller.revokeSession(
      {
        userId: 'user-id',
        sessionId: currentSessionId,
      } as AuthenticatedRequest,
      currentSessionId,
      response,
    );

    expect(authService.revokeUserSession).toHaveBeenCalledWith(
      'user-id',
      currentSessionId,
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.any(Object),
    );
  });

  it('lists sessions using the authenticated request ids', async () => {
    authService.findSessions.mockResolvedValue([]);

    await expect(
      controller.findSessions({
        userId: 'user-id',
        sessionId: 'current-session-id',
      } as AuthenticatedRequest),
    ).resolves.toEqual([]);
    expect(authService.findSessions).toHaveBeenCalledWith(
      'user-id',
      'current-session-id',
    );
  });
});
