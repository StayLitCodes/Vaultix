import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/database')
  async getDatabaseHealth() {
    const dbType = this.dataSource.options.type;
    const isConnected = this.dataSource.isInitialized;
    let migrationCount = 0;
    let migrationStatus = 'unknown';

    try {
      await this.dataSource.query('SELECT 1');
      const result = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM "migrations"',
      );
      const countValue = Array.isArray(result) ? result[0]?.count : undefined;
      migrationCount = typeof countValue === 'string' ? Number(countValue) : Number(countValue || 0);
      migrationStatus = Number.isFinite(migrationCount) ? 'ok' : 'unknown';
    } catch (error) {
      migrationStatus = 'unavailable';
    }

    return {
      status: isConnected ? 'ok' : 'down',
      database: {
        type: dbType,
        connected: isConnected,
        migrationStatus,
        migrationsExecuted: migrationCount,
      },
    };
  }
}
