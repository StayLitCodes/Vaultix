import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RoleChangeDto {
  @ApiProperty({
    description: 'Reason for the role change (required for audit trail)',
    example: 'Promoting to admin for platform moderation duties',
  })
  @IsString()
  @IsNotEmpty({ message: 'Reason is required for audit trail' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason!: string;
}
