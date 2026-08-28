import { Module } from '@nestjs/common';
import {
  EscrowV2Controller,
  AuthV2Controller,
  NotificationsV2Controller,
} from './v2-scaffold.controller';

/**
 * V2 API module.
 *
 * Contains scaffold controllers for the upcoming v2 API.
 * These controllers define the planned endpoint structure but return
 * placeholder responses until v2 is fully implemented.
 *
 * To enable v2 endpoints:
 * 1. Import this module in AppModule
 * 2. Implement the endpoint handlers
 * 3. Add v2 to the Swagger version selector in main.ts
 */
@Module({
  controllers: [
    EscrowV2Controller,
    AuthV2Controller,
    NotificationsV2Controller,
  ],
})
export class ApiV2Module {}
