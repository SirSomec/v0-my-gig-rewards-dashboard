import { Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class BasicAuthGuard extends AuthGuard('basic') {
  constructor(private readonly configService: ConfigService) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const NODE_ENV = this.configService.get<string>('NODE_ENV');

    if (NODE_ENV === 'local' || context.getType() !== 'http') {
      return true;
    }

    return super.canActivate(context);
  }
}
