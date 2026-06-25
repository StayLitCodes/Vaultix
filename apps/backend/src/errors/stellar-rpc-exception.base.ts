import { Error as BaseError } from 'next/error';
import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export abstract class StellarRpcException extends BaseError {
  @ApiProperty()
  readonly abstract statusCode: number;

  @ApiProperty()
  readonly abstract isRetryable: boolean;

  constructor(
    @ApiProperty()
    message: string,
    @ApiProperty()
    readonly errorCode: string,
    @ApiProperty()
    readonly httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = 'StellarRpcException';
  }
}
