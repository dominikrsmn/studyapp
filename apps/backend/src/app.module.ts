import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './infrastructure/config/env.schema';
import { ModulesModule } from './features/modules/modules.module';
import { AuthModule } from './features/auth/auth.module';
import { SourceModule } from './features/source/source.module';
import { SemestersModule } from './features/semesters/semesters.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    AuthModule,
    ModulesModule,
    SourceModule,
    SemestersModule,
  ],
})
export class AppModule {}
