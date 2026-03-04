import { applyDecorators, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

type DocumentationFactory = () => MethodDecorator;

export function Action(
  pattern: string,
  documentationFactory: DocumentationFactory,
  status: HttpStatus = HttpStatus.OK,
): MethodDecorator {
  return applyDecorators(
    ApiSecurity('basic'),
    Post(pattern),
    HttpCode(status),
    documentationFactory(),
  );
}
