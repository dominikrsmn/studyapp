jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));

import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { authConfig } from './auth.config';
import { applicationConfig } from '../../infrastructure/config/application.config';

describe('AuthController', () => {
  const refreshTokenCookie = authConfig().refreshTokenCookie.name;
  const authService = {
    requestMagicLink: jest.fn(),
    verifyMagicLink: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    findSessions: jest.fn(),
    revokeUserSession: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(
      authService as unknown as AuthService,
      authConfig(),
      applicationConfig(),
    );
  });

  it('passes a safe return URL into the magic-link request', async () => {
    authService.requestMagicLink.mockResolvedValue(undefined);

    await controller.requestMagicLink({
      email: 'student@example.com',
    });

    expect(authService.requestMagicLink).toHaveBeenCalledWith(
      'student@example.com',
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
      refreshTokenCookie,
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
      cookies: { [refreshTokenCookie]: 'current-refresh-token' },
    } as unknown as Request;
    const response = { cookie: jest.fn() } as unknown as Response;

    await expect(controller.refresh(request, response)).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    });
    expect(authService.refresh).toHaveBeenCalledWith('current-refresh-token');
    expect(response.cookie).toHaveBeenCalledWith(
      refreshTokenCookie,
      'new-refresh-token',
      expect.any(Object),
    );
  });

  it('revokes the session and clears its refresh cookie on logout', async () => {
    authService.logout.mockResolvedValue(undefined);
    const request = {
      cookies: { [refreshTokenCookie]: 'refresh-token' },
    } as unknown as Request;
    const response = { clearCookie: jest.fn() } as unknown as Response;

    await controller.logout(request, response);

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.clearCookie).toHaveBeenCalledWith(
      refreshTokenCookie,
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
      refreshTokenCookie,
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
