import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { BasicStrategy } from 'passport-http';

@Injectable()
export class BasicAuthStrategy extends PassportStrategy(BasicStrategy) {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  validate(username: string, password: string): any {
    const validUsername = this.configService.get<string>('SERVICE_USERNAME');
    const validPassword = this.configService.get<string>('SERVICE_PASSWORD');

    if (username !== validUsername || password !== validPassword) {
      throw new UnauthorizedException();
    }

    return { username };
  }
}
