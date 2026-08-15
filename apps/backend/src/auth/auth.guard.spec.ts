jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { UsersService } from '../users/users.service';

describe('AuthGuard', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  const usersService = { findOne: jest.fn() };
  let guard: AuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      reflector as unknown as Reflector,
      usersService as unknown as UsersService,
    );
  });

  it('puts only the verified user and session ids on the request', async () => {
    const request = {
      headers: { authorization: 'Bearer signed-token' },
    } as Request;
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'authenticated-user-id',
      sessionId: 'authenticated-session-id',
      email: 'user@example.com',
      type: 'access',
      exp: 1_800_000_000,
    });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('signed-token', {
      audience: 'studyapp-api',
      issuer: 'studyapp',
    });
    expect(request.userId).toBe('authenticated-user-id');
    expect(request.sessionId).toBe('authenticated-session-id');
    expect(request).not.toHaveProperty('user');
    expect(usersService.findOne).not.toHaveBeenCalled();
  });

  it('loads the database user only when the route requests it', async () => {
    const request = {
      headers: { authorization: 'Bearer signed-token' },
    } as Request;
    const user = { id: 'authenticated-user-id', email: 'user@example.com' };
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      sessionId: 'authenticated-session-id',
      email: user.email,
      type: 'access',
      exp: 1_800_000_000,
    });
    usersService.findOne.mockResolvedValue(user);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(usersService.findOne).toHaveBeenCalledWith(user.id);
    expect(request.currentUser).toBe(user);
  });

  it('rejects a requested database user that no longer exists', async () => {
    const request = {
      headers: { authorization: 'Bearer signed-token' },
    } as Request;
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'deleted-user-id',
      sessionId: 'authenticated-session-id',
      email: 'deleted@example.com',
      type: 'access',
      exp: 1_800_000_000,
    });
    usersService.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.findOne).toHaveBeenCalledWith('deleted-user-id');
  });

  it('does not trust an unverified token subject', async () => {
    const request = {
      headers: { authorization: 'Bearer forged-token' },
    } as Request;
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.userId).toBeUndefined();
    expect(usersService.findOne).not.toHaveBeenCalled();
  });
});

function contextFor(request: Request): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
