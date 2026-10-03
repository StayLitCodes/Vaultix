import { IsEnum, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationEventType } from '../enums/notification-event.enum';

export class UpdatePreferencesDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsBoolean()
  enabled: boolean;

  // May be empty when the user opts out of every event on this channel
  @IsArray()
  @IsEnum(NotificationEventType, { each: true })
  eventTypes: NotificationEventType[];

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;
}
