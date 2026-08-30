import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Repository } from 'typeorm';
import { UpdatePreferencesDto } from './entities/update-preferences.dto';
import {
  NotificationChannel,
  NotificationEventType,
} from './enums/notification-event.enum';

@Injectable()
export class PreferenceService {
  constructor(
    @InjectRepository(NotificationPreference)
    private repo: Repository<NotificationPreference>,
  ) {}

  async getUserPreferences(userId: string) {
    return this.repo.find({ where: { userId } });
  }

  /**
   * Creates default preferences (all event types enabled on every channel)
   * for a newly registered user. Idempotent: existing preferences are kept.
   */
  async seedDefaultPreferences(
    userId: string,
  ): Promise<NotificationPreference[]> {
    const existing = await this.repo.find({ where: { userId } });
    if (existing.length > 0) {
      return existing;
    }

    const allEventTypes = Object.values(NotificationEventType);
    const defaults = Object.values(NotificationChannel).map((channel) =>
      this.repo.create({
        userId,
        channel,
        enabled: true,
        eventTypes: allEventTypes,
      }),
    );

    return this.repo.save(defaults);
  }

  async updatePreferences(
    userId: string,
    updates: UpdatePreferencesDto[],
  ): Promise<NotificationPreference[]> {
    const results: NotificationPreference[] = [];

    for (const update of updates) {
      let pref = await this.repo.findOne({
        where: { userId, channel: update.channel },
      });

      if (!pref) {
        pref = this.repo.create({
          userId,
          channel: update.channel,
          enabled: update.enabled,
          eventTypes: update.eventTypes,
        });
      } else {
        pref.enabled = update.enabled;
        pref.eventTypes = update.eventTypes;
      }

      const saved = await this.repo.save(pref);
      results.push(saved);
    }

    return results;
  }
}
