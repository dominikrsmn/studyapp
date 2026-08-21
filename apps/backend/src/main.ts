/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { applicationConfig } from './infrastructure/config/application.config';
import type { ConfigType } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigType<typeof applicationConfig>>(
    applicationConfig.KEY,
  );
  app.setGlobalPrefix(config.globalPrefix);

  app.use(cookieParser());
  await app.listen(config.port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${config.port}/${config.globalPrefix}`,
  );
}

bootstrap();
