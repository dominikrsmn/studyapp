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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow('REDIS_PORT'),
          username: config.getOrThrow('REDIS_USERNAME'),
          password: config.getOrThrow('REDIS_PASSWORD'),
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
