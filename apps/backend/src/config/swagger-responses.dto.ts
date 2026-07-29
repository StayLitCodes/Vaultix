// Closes #405: shared, reusable Swagger response schemas so controllers can
// reference one consistent shape for errors and pagination instead of each
// hand-rolling @ApiResponse inline. Applying @ApiTags/@ApiOperation/etc.
// across every controller is a much larger follow-up.
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: '/api/escrows', required: false })
  path?: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  pageSize: number;

  @ApiProperty({ example: 231 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
