export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  email: string;
  type: 'access';
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
}
