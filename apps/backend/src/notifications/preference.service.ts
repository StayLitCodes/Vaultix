import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Repository } from 'typeorm';
import { UpdatePreferencesDto } from './entities/update-preferences.dto';

@Injectable()
export class PreferenceService {
  constructor(
    @InjectRepository(NotificationPreference)
    private repo: Repository<NotificationPreference>,
  ) {}

  async getUserPreferences(userId: string) {
    return this.repo.find({ where: { userId } });
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
