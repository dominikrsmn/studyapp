import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './infrastructure/config/env.schema';
import { ModuleModule } from './features/module/module.module';
import { AuthModule } from './features/auth/auth.module';
import { SourceModule } from './features/source/source.module';
import { SemesterModule } from './features/semester/semester.module';
import { UserModule } from './features/user/user.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    ModuleModule,
    SourceModule,
    SemesterModule,
    UserModule,
  ],
})
export class AppModule {}
