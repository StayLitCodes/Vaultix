// backend/src/database/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { EmailVerification } from '../entities/email-verification.entity';
import { User } from '../entities/user.entity';
import { Vault } from '../entities/vault.entity';
import * as path from 'path';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
    // Determine whether we are running in a compiled JavaScript build (dist/) or TypeScript source (src/)
    const isCompiled = __dirname.includes('dist');
    const migrationExtension = isCompiled ? 'js' : 'ts';
    const entitiesPath = isCompiled ? __dirname + '/../entities/*.entity.js' : [User, Vault, EmailVerification];
    const migrationsPath = path.join(__dirname, `../../migrations/*.${migrationExtension}`);

    return {
        type: 'sqlite',
        database: process.env.DATABASE_NAME || 'vaultix.sqlite',
        entities: entitiesPath,
        migrations: [migrationsPath],
        synchronize: false, // Enforce explicit migrations as required by acceptance criteria
        migrationsRun: true,  // Automatically run pending migrations on startup
        logging: ['error', 'migration'],
    };
};