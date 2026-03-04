import { Injectable, NestMiddleware } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Логирует входящие HTTP-запросы (метод и URL). Замена RequestLoggerMiddleware из @mygigtechnologies/nest-logger.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, _res: Response, next: NextFunction) {
    this.logger.log(`${req.method} ${req.originalUrl || req.url}`);
    next();
  }
}
