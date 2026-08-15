jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));

import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Env } from '../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './refresh-token.cookie';

describe('AuthController', () => {
  const authService = {
    verifyMagicLink: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
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
    authService.verifyMagicLink.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const response = { cookie: jest.fn() } as unknown as Response;

    await expect(
      controller.verifyMagicLink({ token: 'magic-token' }, response),
    ).resolves.toEqual({ accessToken: 'access-token' });
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
    authService.refresh.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    const request = {
      cookies: { [REFRESH_TOKEN_COOKIE]: 'current-refresh-token' },
    } as unknown as Request;
    const response = { cookie: jest.fn() } as unknown as Response;

    await expect(controller.refresh(request, response)).resolves.toEqual({
      accessToken: 'new-access-token',
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
});
