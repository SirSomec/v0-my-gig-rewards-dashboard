import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule as MongooseNestModule } from '@nestjs/mongoose';

import { MongooseService } from './mongoose.service';
import { Envs } from '../../../shared/env.validation-schema';

@Global()
@Module({
  imports: [
    MongooseNestModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Envs, true>) => ({
        uri: configService.get<string>('MONGO_CONNECTION'),
      }),
    }),
  ],
  exports: [MongooseService],
  providers: [MongooseService],
})
export class MongooseModule {}
