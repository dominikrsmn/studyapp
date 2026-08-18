import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Env } from '../config/env.schema';
@Injectable()
export class OpenAiService {
  readonly client: OpenAI;

  constructor(config: ConfigService<Env, true>) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow('OPENAI_API_KEY'),
    });
  }
}
