import { computed, Injectable, signal } from '@angular/core';

export interface AccessTokenClaims {
  sub: string;
  sessionId: string;
  email: string;
  type: 'access';
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly accessTokenState = signal<string | null>(null);

  readonly accessTokenClaims = computed(() =>
    decodeAccessToken(this.accessTokenState()),
  );
  readonly isAuthenticated = computed(() => this.accessTokenClaims() !== null);
  readonly email = computed(() => this.accessTokenClaims()?.email ?? null);
  readonly sessionId = computed(
    () => this.accessTokenClaims()?.sessionId ?? null,
  );
  readonly accessTokenExpiresAt = computed(() => {
    const expiresAt = this.accessTokenClaims()?.exp;
    return expiresAt ? new Date(expiresAt * 1000) : null;
  });
  getAccessToken(): string | null {
    return this.accessTokenState();
  }

  setAccessToken(accessToken: string): void {
    this.accessTokenState.set(accessToken);
  }

  clearAccessToken(): void {
    this.accessTokenState.set(null);
  }
}

function decodeAccessToken(token: string | null): AccessTokenClaims | null {
  if (!token) {
    return null;
  }

  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) {
      return null;
    }

    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const binaryPayload = globalThis.atob(paddedBase64);
    const payloadBytes = Uint8Array.from(binaryPayload, (character) =>
      character.charCodeAt(0),
    );
    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as Partial<AccessTokenClaims>;

    if (
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sessionId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}
