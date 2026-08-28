import { Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  userId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getCurrentContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

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
    const cid = ctx?.correlationId ?? getCorrelationId() ?? generateId();
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
