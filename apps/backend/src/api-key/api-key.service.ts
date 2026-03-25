import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { generateApiKey, hashKey } from './utils/api-key.util';

interface CreateApiKeyDto {
  name: string;
  rateLimitPerMinute?: number;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private repo: Repository<ApiKey>,
  ) {}

  async create(ownerUserId: string, dto: CreateApiKeyDto) {
    const rawKey = generateApiKey();

    const apiKey = this.repo.create({
      name: dto.name,
      ownerUserId,
      keyHash: hashKey(rawKey),
      rateLimitPerMinute:
        dto.rateLimitPerMinute ?? Number(process.env.DEFAULT_RATE_LIMIT ?? 60),
    });

    const saved = await this.repo.save(apiKey);

    return {
      id: saved.id,
      name: saved.name,
      key: rawKey,
      rateLimitPerMinute: saved.rateLimitPerMinute,
      createdAt: saved.createdAt,
    };
  }

  async findByRawKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = hashKey(rawKey);
    return this.repo.findOne({ where: { keyHash } });
  }

  async list(ownerUserId: string) {
    return this.repo.find({
      where: { ownerUserId },
      select: ['id', 'name', 'active', 'rateLimitPerMinute', 'createdAt'],
    });
  }

  async revoke(id: string, ownerUserId: string) {
    const key = await this.repo.findOne({
      where: { id, ownerUserId },
    });

    if (!key) throw new NotFoundException();

    key.active = false;
    key.revokedAt = new Date();

    return this.repo.save(key);
  }
}
