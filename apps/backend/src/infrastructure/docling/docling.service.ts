import { Inject, Injectable } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { DoclingClient } from '@docling/docling-client';
import type { DoclingDocument } from '@docling/docling-core';

import { Env } from '../config/env.schema';
import { doclingConfig } from '../config/docling.config';

@Injectable()
export class DoclingService {
  readonly client: DoclingClient<DoclingDocument>;

  constructor(
    @Inject(doclingConfig.KEY)
    private readonly config: ConfigType<typeof doclingConfig>,
    private readonly env: ConfigService<Env, true>,
  ) {
    this.client = new DoclingClient<DoclingDocument>({
      baseUrl: env.getOrThrow('DOCLING_URL', { infer: true }),
      apiKey: env.getOrThrow('DOCLING_API_KEY'),
      httpTimeoutMs: config.timeout,
      httpRetries: config.retries,
    });
  }
}
