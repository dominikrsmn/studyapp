import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './infrastructure/config/env.schema';
import { ModuleModule } from './features/module/module.module';
import { AuthModule } from './features/auth/auth.module';
import { SourceModule } from './features/source/source.module';
import { SemesterModule } from './features/semester/semester.module';
import { UserModule } from './features/user/user.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AiModule } from './features/ai/ai.module';
import { BullModule } from '@nestjs/bullmq';
import { applicationConfig } from './infrastructure/config/application.config';
import { databaseConfig } from './infrastructure/config/database.config';
import { fileStorageConfig } from './infrastructure/config/filestorage.config';
import { openAiConfig } from './infrastructure/config/open-ai.config';
import { redisConfig } from './infrastructure/config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        applicationConfig,
        databaseConfig,
        fileStorageConfig,
        openAiConfig,
        redisConfig,
      ],
      validate: (config) => envSchema.parse(config),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        connection: {
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
        },
      }),
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    ModuleModule,
    SourceModule,
    SemesterModule,
    UserModule,
    AiModule,
  ],
})
export class AppModule {}
