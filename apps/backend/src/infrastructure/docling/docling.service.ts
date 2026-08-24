import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Docling, type DoclingAPIClientType } from 'docling-sdk/platform';
import { Env } from '../config/env.schema';

@Injectable()
export class DoclingService {
  readonly client: DoclingAPIClientType;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Docling({
      api: {
        baseUrl: config.getOrThrow('DOCLING_URL', { infer: true }),
        apiKey: config.getOrThrow('DOCLING_API_KEY', { infer: true }),
      },
    });
  }
}
