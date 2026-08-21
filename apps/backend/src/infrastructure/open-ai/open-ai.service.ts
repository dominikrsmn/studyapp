import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import OpenAI from 'openai';
import { openAiConfig } from '../config/open-ai.config';
@Injectable()
export class OpenAiService {
  readonly client: OpenAI;

  constructor(
    @Inject(openAiConfig.KEY) config: ConfigType<typeof openAiConfig>,
  ) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }
}
