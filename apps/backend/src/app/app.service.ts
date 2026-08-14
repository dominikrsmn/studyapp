import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  getData(): { message: string } {
    const testValue = this.config.get('NODE_ENV', { infer: true });
    return { message: `Hello API - ${testValue}` };
  }
}
