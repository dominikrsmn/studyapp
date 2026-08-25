import { Inject, Injectable } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import type { DoclingAPIClientType } from 'docling-sdk/platform';
import { createAPIClient } from 'docling-sdk';

import { Env } from '../config/env.schema';
import { doclingConfig } from '../config/docling.config';

@Injectable()
export class DoclingService {
  readonly client: DoclingAPIClientType;

  constructor(
    @Inject(doclingConfig.KEY)
    private readonly config: ConfigType<typeof doclingConfig>,
    private readonly env: ConfigService<Env, true>,
  ) {
    this.client = createAPIClient(
      env.getOrThrow('DOCLING_URL', { infer: true }),
      {
        timeout: config.timeout,
        retries: config.retries,
        headers: {
          Authorization: `Bearer ${env.getOrThrow('DOCLING_API_KEY')}`,
        },
      },
    );
  }
}
