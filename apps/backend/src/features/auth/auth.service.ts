import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { UserService } from '../user/user.service';
import type {
  MagicLinkTokenPayload,
  AuthSession,
  RefreshTokenPayload,
  TokenPair,
} from './auth.types';
import { authConfig } from './auth.config';
import { applicationConfig } from '../../infrastructure/config/application.config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    @Inject(applicationConfig.KEY)
    private readonly application: ConfigType<typeof applicationConfig>,
  ) {}

  async requestMagicLink(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const tokenId = randomUUID();
    const token = await this.jwtService.signAsync(
      { email: normalizedEmail, type: 'magic-link' },
      {
        audience: this.config.audiences.magicLink,
        issuer: this.config.issuer,
        expiresIn: this.config.magicLinkTtlSeconds,
        jwtid: tokenId,
      },
    );

    await this.prisma.magicLinkToken.create({
      data: {
        id: tokenId,
        email: normalizedEmail,
        tokenHash: this.hashToken(token),
        expiresAt: this.expiresAt(this.config.magicLinkTtlSeconds),
      },
    });

    if (this.application.environment === 'development') {
      const link = new URL(
        this.config.magicLinkVerificationPath,
        this.config.webUrl,
      );
      link.searchParams.set('token', token);
      this.logger.log(
        `Magic sign-in link for ${normalizedEmail}: ${link.toString()}`,
      );
    }
  }

  async verifyMagicLink(token: string): Promise<TokenPair> {
    const payload = await this.verifyMagicToken(token);
    const now = new Date();
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const user = await this.usersService.findOrCreateByEmail(payload.email);
    const tokens = await this.createTokenPair({
      userId: user.id,
      email: user.email,
      sessionId,
      refreshTokenId,
    });

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.magicLinkToken.updateMany({
        where: {
          id: payload.jti,
          tokenHash: this.hashToken(token),
          email: payload.email,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Magic link is invalid or expired');
      }

      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokens: {
            create: {
              id: refreshTokenId,
              tokenHash: this.hashToken(tokens.refreshToken),
              expiresAt: tokens.refreshTokenExpiresAt,
            },
          },
        },
      });
    });

    return tokens;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const now = new Date();
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { session: { include: { user: true } } },
    });

    if (
      !storedToken ||
      storedToken.id !== payload.jti ||
      storedToken.sessionId !== payload.sessionId ||
      storedToken.expiresAt <= now ||
      storedToken.session.revokedAt
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (storedToken.usedAt || storedToken.revokedAt) {
      return this.rejectReusedRefreshToken(
        storedToken.id,
        storedToken.sessionId,
        now,
      );
    }

    const nextTokenId = randomUUID();
    const tokens = await this.createTokenPair({
      userId: storedToken.session.user.id,
      email: storedToken.session.user.email,
      sessionId: storedToken.sessionId,
      refreshTokenId: nextTokenId,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.refreshToken.create({
          data: {
            id: nextTokenId,
            sessionId: storedToken.sessionId,
            tokenHash: this.hashToken(tokens.refreshToken),
            expiresAt: tokens.refreshTokenExpiresAt,
          },
        });

        const claimed = await tx.refreshToken.updateMany({
          where: { id: storedToken.id, usedAt: null, revokedAt: null },
          data: { usedAt: now, replacedByTokenId: nextTokenId },
        });

        if (claimed.count !== 1) {
          throw new UnauthorizedException(
            'Refresh token has already been used',
          );
        }

        await tx.session.update({
          where: { id: storedToken.sessionId },
          data: { lastUsedAt: now },
        });
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return this.rejectReusedRefreshToken(
          storedToken.id,
          storedToken.sessionId,
          now,
        );
      }
      throw error;
    }

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.revokeSession(payload.sessionId, new Date());
  }

  async findSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<AuthSession[]> {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        refreshTokens: {
          some: {
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        refreshTokens: {
          where: {
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { expiresAt: true },
        },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.flatMap((session) => {
      const activeRefreshToken = session.refreshTokens[0];
      return activeRefreshToken
        ? [
            {
              id: session.id,
              createdAt: session.createdAt,
              lastUsedAt: session.lastUsedAt,
              refreshTokenExpiresAt: activeRefreshToken.expiresAt,
              isCurrent: session.id === currentSessionId,
            },
          ]
        : [];
    });
  }

  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException('Session was not found');
    }

    await this.revokeSession(session.id, new Date());
  }

  private async verifyMagicToken(
    token: string,
  ): Promise<MagicLinkTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<MagicLinkTokenPayload>(
        token,
        {
          audience: this.config.audiences.magicLink,
          issuer: this.config.issuer,
        },
      );
      if (payload.type !== 'magic-link' || !payload.email || !payload.jti) {
        throw new Error('Invalid magic-link payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Magic link is invalid or expired');
    }
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          audience: this.config.audiences.refresh,
          issuer: this.config.issuer,
        },
      );
      if (payload.type !== 'refresh' || !payload.sessionId || !payload.jti) {
        throw new Error('Invalid refresh-token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  private async createTokenPair(input: {
    userId: string;
    email: string;
    sessionId: string;
    refreshTokenId: string;
  }): Promise<TokenPair> {
    const commonPayload = {
      sub: input.userId,
      sessionId: input.sessionId,
      email: input.email,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...commonPayload, type: 'access' },
        {
          audience: this.config.audiences.access,
          issuer: this.config.issuer,
          expiresIn: this.config.accessTokenTtlSeconds,
        },
      ),
      this.jwtService.signAsync(
        { ...commonPayload, type: 'refresh' },
        {
          audience: this.config.audiences.refresh,
          issuer: this.config.issuer,
          expiresIn: this.config.refreshTokenTtlSeconds,
          jwtid: input.refreshTokenId,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: this.expiresAt(this.config.refreshTokenTtlSeconds),
    };
  }

  private async revokeSession(
    sessionId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt },
      }),
    ]);
  }

  private async rejectReusedRefreshToken(
    tokenId: string,
    sessionId: string,
    now: Date,
  ): Promise<never> {
    const currentToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      select: { usedAt: true, revokedAt: true },
    });

    if (
      currentToken?.usedAt &&
      !currentToken.revokedAt &&
      now.getTime() - currentToken.usedAt.getTime() <=
        this.config.refreshRotationGraceMs
    ) {
      throw new ConflictException('Refresh token was just rotated');
    }

    await this.revokeSession(sessionId, now);
    throw new UnauthorizedException('Refresh token has already been used');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiresAt(ttlSeconds: number): Date {
    return new Date(Date.now() + ttlSeconds * 1000);
  }
}
