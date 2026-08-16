import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from '../config/env.schema';
import { ModulesModule } from '../modules/modules.module';
import { AuthModule } from '../auth/auth.module';
import { SourceModule } from '../source/source.module';
import { SemestersModule } from '../semesters/semesters.module';

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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
