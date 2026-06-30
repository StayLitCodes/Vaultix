import { Logger } from '@nestjs/common';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  action?: string;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class CorrelationLogger {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  private format(message: string, ctx?: LogContext): string {
    const cid = ctx?.correlationId ?? generateId();
    const meta = ctx ? { ...ctx, correlationId: cid } : { correlationId: cid };
    return `[cid:${cid}] ${message} | ${JSON.stringify(meta)}`;
  }

  log(message: string, ctx?: LogContext): void {
    this.logger.log(this.format(message, ctx));
  }

  warn(message: string, ctx?: LogContext): void {
    this.logger.warn(this.format(message, ctx));
  }

  error(message: string, ctx?: LogContext): void {
    this.logger.error(this.format(message, ctx));
  }
}

export function createLogger(context: string): CorrelationLogger {
  return new CorrelationLogger(context);
}
