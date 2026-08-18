export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  email: string;
  type: 'access';
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  email: string;
  type: 'refresh';
  jti: string;
}

export interface MagicLinkTokenPayload {
  email: string;
  type: 'magic-link';
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthSession {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  refreshTokenExpiresAt: Date;
  isCurrent: boolean;
}
