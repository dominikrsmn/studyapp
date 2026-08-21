import { TestBed } from '@angular/core/testing';
import type {
  EventSourceMessage} from '@microsoft/fetch-event-source';
import {
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import { defer, firstValueFrom, of } from 'rxjs';
import { z } from 'zod';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthTokenService } from './auth-token.service';
import { SseAuthService } from './sse-auth.service';

vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(),
}));

describe('SseAuthService', () => {
  const fetchEventSourceMock = vi.mocked(fetchEventSource);
  const authRefresh = {
    refreshAccessToken: vi.fn(),
  };

  beforeEach(() => {
    fetchEventSourceMock.mockReset();
    authRefresh.refreshAccessToken.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthRefreshService, useValue: authRefresh }],
    });
  });

  it('refreshes after an unauthorized response and reconnects with the new token', async () => {
    const tokens = TestBed.inject(AuthTokenService);
    tokens.setAccessToken('expired-access-token');
    authRefresh.refreshAccessToken.mockReturnValue(
      defer(() => {
        tokens.setAccessToken('new-access-token');
        return of('new-access-token');
      }),
    );
    fetchEventSourceMock
      .mockImplementationOnce(async (_url, options) => {
        await options.onopen?.(new Response(null, { status: 401 }));
      })
      .mockImplementationOnce(async (_url, options) => {
        await options.onopen?.(new Response(null, { status: 200 }));
        options.onmessage?.({
          data: JSON.stringify({ status: 'ready' }),
          event: '',
          id: '',
        } satisfies EventSourceMessage);
      });

    const result = await firstValueFrom(
      TestBed.inject(SseAuthService).connect(
        '/api/events',
        z.object({ status: z.literal('ready') }),
      ),
    );

    expect(result).toEqual({ status: 'ready' });
    expect(authRefresh.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchEventSourceMock).toHaveBeenCalledTimes(2);
    expect(fetchEventSourceMock.mock.calls[0][1].headers).toEqual({
      Authorization: 'Bearer expired-access-token',
    });
    expect(fetchEventSourceMock.mock.calls[1][1].headers).toEqual({
      Authorization: 'Bearer new-access-token',
    });
  });

  it('runs the open hook after every successful connection', async () => {
    const onOpen = vi.fn();
    fetchEventSourceMock.mockImplementation(async (_url, options) => {
      await options.onopen?.(new Response(null, { status: 200 }));
      await options.onopen?.(new Response(null, { status: 200 }));
      options.onmessage?.({
        data: JSON.stringify({ status: 'ready' }),
        event: '',
        id: '',
      } satisfies EventSourceMessage);
    });

    await firstValueFrom(
      TestBed.inject(SseAuthService).connect(
        '/api/events',
        z.object({ status: z.literal('ready') }),
        { onOpen },
      ),
    );

    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
