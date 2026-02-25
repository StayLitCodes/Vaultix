import { IsEnum, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationEventType } from '../enums/notification-event.enum';

export class UpdatePreferencesDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationEventType, { each: true })
  eventTypes: NotificationEventType[];
}
