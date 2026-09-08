import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { parseResponse } from 'openai/lib/ResponsesParser';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { Env } from '../config/env.schema';
import { PrismaService } from '../database/prisma/prisma.service';
import { jobCostContext } from './job-cost-context';
import { calculateResponseCost } from './response-cost';

@Injectable()
export class OpenAiService {
  readonly client: OpenAI;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow('OPENAI_API_KEY', { infer: true }),
    });
  }

  async createResponse(body: ResponseCreateParamsNonStreaming) {
    const response = await this.client.responses.create(body);
    await this.prisma.aiRequestCost.create({
      data: {
        costUsd: calculateResponseCost(response),
        ...(jobCostContext.getStore()
          ? { jobId: jobCostContext.getStore() }
          : {}),
      },
    });
    return response;
  }

  async parseResponse<Params extends ResponseCreateParamsNonStreaming>(
    body: Params,
  ) {
    const response = await this.createResponse(body);
    return parseResponse(response, body);
  }
}
