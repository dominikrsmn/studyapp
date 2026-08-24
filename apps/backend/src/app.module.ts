import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Env, envSchema } from './infrastructure/config/env.schema';
import { ModuleModule } from './features/module/module.module';
import { AuthModule } from './features/auth/auth.module';
import { SourceModule } from './features/source/source.module';
import { SemesterModule } from './features/semester/semester.module';
import { UserModule } from './features/user/user.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AiModule } from './features/ai/ai.module';
import { BullModule } from '@nestjs/bullmq';
import { applicationConfig } from './infrastructure/config/application.config';
import { fileStorageConfig } from './infrastructure/config/filestorage.config';
import { TopicModule } from './features/topic/topic.module';
import { embeddingConfig } from './infrastructure/config/embedding.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [applicationConfig, embeddingConfig, fileStorageConfig],
      validate: (config) => envSchema.parse(config),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST', { infer: true }),
          port: config.getOrThrow('REDIS_PORT', { infer: true }),
          username: config.getOrThrow('REDIS_USERNAME', { infer: true }),
          password: config.getOrThrow('REDIS_PASSWORD', { infer: true }),
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
    TopicModule,
  ],
})
export class AppModule {}
