import { Module } from '@nestjs/common';
import { EventsModule } from './events.module';

@Module({
  imports: [EventsModule],
  exports: [EventsModule],
})
export class GatewaysModule {}
