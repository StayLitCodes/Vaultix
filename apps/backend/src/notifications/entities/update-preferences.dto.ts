import { IsEnum, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationEventType } from '../enums/notification-event.enum';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({ description: 'The notification channel (e.g., EMAIL, IN_APP)', enum: NotificationChannel, example: 'EMAIL' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Whether notifications for this channel are enabled', example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Types of events to notify about', enum: NotificationEventType, isArray: true, example: ['ESCROW_CREATED'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationEventType, { each: true })
  eventTypes: NotificationEventType[];
}
