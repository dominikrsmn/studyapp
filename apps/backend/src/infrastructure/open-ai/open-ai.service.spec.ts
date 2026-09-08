import { jobCostContext } from './job-cost-context';
import { ConfigService } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { Env } from '../config/env.schema';
import { PrismaService } from '../database/prisma/prisma.service';
import { OpenAiService } from './open-ai.service';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

describe('OpenAiService cost persistence', () => {
  const save = jest.fn();
  let service: OpenAiService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OpenAiService(
      { getOrThrow: () => 'test-key' } as unknown as ConfigService<Env, true>,
      { aiRequestCost: { create: save } } as unknown as PrismaService,
    );
  });

  const response = {
    model: 'gpt-5.6-luna',
    usage: {
      input_tokens: 10,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 5,
    },
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: 'invalid JSON' }],
      },
    ],
  };

  it('associates each recorded request with its current job', async () => {
    jest
      .spyOn(service.client.responses, 'create')
      .mockResolvedValue(response as never);
    await jobCostContext.run('execution-id', () =>
      service.createResponse({ model: 'gpt-5.6-luna' }),
    );
    expect(save).toHaveBeenCalledWith({
      data: { costUsd: '0.00000800', jobId: 'execution-id' },
    });
  });

  it('stores only the amount and returns the original response', async () => {
    jest
      .spyOn(service.client.responses, 'create')
      .mockResolvedValue(response as never);
    await expect(
      service.createResponse({ model: 'gpt-5.6-luna' }),
    ).resolves.toBe(response);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ data: { costUsd: '0.00000800' } });
  });

  it('stores costs before a structured output parsing failure', async () => {
    jest
      .spyOn(service.client.responses, 'create')
      .mockResolvedValue(response as never);
    await expect(
      service.parseResponse({
        model: 'gpt-5.6-luna',
        text: {
          format: zodTextFormat(z.object({ title: z.string() }), 'title'),
        },
      }),
    ).rejects.toThrow();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not invent costs when the request fails', async () => {
    jest
      .spyOn(service.client.responses, 'create')
      .mockRejectedValue(new Error('request failed'));
    await expect(
      service.createResponse({ model: 'gpt-5.6-luna' }),
    ).rejects.toThrow('request failed');
    expect(save).not.toHaveBeenCalled();
  });
});
