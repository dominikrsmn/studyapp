import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getData(): { message: string } {
    const testValue = this.config.get('TEST');
    return { message: `Hello API - ${testValue}` };
  }
}
