import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { generateApiKey, getKeyPrefix, hashKey, verifyKey } from './utils/api-key.util';

const MAX_ACTIVE_KEYS = 5;

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private repo: Repository<ApiKey>,
  ) {}

  async create(userId: string, dto: CreateApiKeyDto) {
    // Check max active keys limit
    const activeKeyCount = await this.repo.count({
      where: { userId, isActive: true },
    });

    if (activeKeyCount >= MAX_ACTIVE_KEYS) {
      throw new BadRequestException(
        `Maximum of ${MAX_ACTIVE_KEYS} active API keys allowed per user`,
      );
    }

    const rawKey = generateApiKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const apiKey = this.repo.create({
      userId,
      name: dto.name,
      keyHash,
      keyPrefix,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      rateLimitPerMinute: 200,
    });

    const saved = await this.repo.save(apiKey);

    return {
      id: saved.id,
      name: saved.name,
      key: rawKey,
      keyPrefix: saved.keyPrefix,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt,
      rateLimitPerMinute: saved.rateLimitPerMinute,
      createdAt: saved.createdAt,
    };
  }

  async findByRawKey(rawKey: string): Promise<ApiKey | null> {
    const keys = await this.repo.find({ where: { isActive: true } });
    
    for (const key of keys) {
      const isValid = await verifyKey(rawKey, key.keyHash);
      if (isValid) {
        return key;
      }
    }
    
    return null;
  }

  async list(userId: string) {
    const keys = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      rateLimitPerMinute: key.rateLimitPerMinute,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  }

  async findOne(id: string, userId: string) {
    const key = await this.repo.findOne({
      where: { id, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      rateLimitPerMinute: key.rateLimitPerMinute,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }

  async update(id: string, userId: string, dto: UpdateApiKeyDto) {
    const key = await this.repo.findOne({
      where: { id, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    if (dto.name !== undefined) key.name = dto.name;
    if (dto.scopes !== undefined) key.scopes = dto.scopes;
    if (dto.isActive !== undefined) key.isActive = dto.isActive;

    return this.repo.save(key);
  }

  async revoke(id: string, userId: string) {
    const key = await this.repo.findOne({
      where: { id, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    key.isActive = false;
    key.revokedAt = new Date();

    return this.repo.save(key);
  }

  async rotate(id: string, userId: string) {
    const existingKey = await this.repo.findOne({
      where: { id, userId },
    });

    if (!existingKey) {
      throw new NotFoundException('API key not found');
    }

    // Deactivate old key
    existingKey.isActive = false;
    existingKey.revokedAt = new Date();
    await this.repo.save(existingKey);

    // Generate new key
    const rawKey = generateApiKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const newKey = this.repo.create({
      userId,
      name: existingKey.name,
      keyHash,
      keyPrefix,
      scopes: existingKey.scopes,
      expiresAt: existingKey.expiresAt,
      rateLimitPerMinute: existingKey.rateLimitPerMinute,
    });

    const saved = await this.repo.save(newKey);

    return {
      id: saved.id,
      name: saved.name,
      key: rawKey,
      keyPrefix: saved.keyPrefix,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt,
      rateLimitPerMinute: saved.rateLimitPerMinute,
      createdAt: saved.createdAt,
    };
  }

  async updateLastUsedAt(keyId: string) {
    await this.repo.update(keyId, { lastUsedAt: new Date() });
  }

  async deactivateExpiredKeys() {
    const now = new Date();
    const result = await this.repo
      .createQueryBuilder()
      .update(ApiKey)
      .set({ isActive: false })
      .where('expiresAt < :now', { now })
      .andWhere('isActive = :isActive', { isActive: true })
      .execute();

    return result.affected || 0;
  }
}
