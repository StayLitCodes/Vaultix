import { IsEnum, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationEventType } from '../enums/notification-event.enum';

export class UpdatePreferencesDto {
  @ApiProperty({ enum: NotificationChannel, description: 'Notification channel to update' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Whether notifications are enabled for this channel', example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Event types to enable or disable', example: ['escrow_created'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationEventType, { each: true })
  eventTypes: NotificationEventType[];
}
