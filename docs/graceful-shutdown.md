# Graceful Shutdown Handler

## Overview

NestJS provides built-in lifecycle hooks for graceful shutdown.
This document describes how to enable them in `main.ts` and implement
`OnModuleDestroy` in long-running services.

## Enabling shutdown hooks in main.ts

Add the following line after `NestFactory.create`:

```ts
app.enableShutdownHooks();
```

This ensures NestJS listens for `SIGTERM` / `SIGINT` and calls `onModuleDestroy`
on every provider that implements it before the process exits.

## Implementing OnModuleDestroy

For services that hold open connections (DB, Redis, WebSocket, scheduled jobs):

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class SomeService implements OnModuleDestroy {
  onModuleDestroy() {
    // close connections, flush buffers, cancel scheduled jobs
  }
}
```

## Services that need this

- `SchedulerService` — cancel cron jobs
- `StellarService` — close streaming connections
- `GatewayService` — close WebSocket server gracefully

## Kubernetes / Docker

Set `terminationGracePeriodSeconds: 30` in the pod spec so the container
has enough time to finish in-flight requests before being killed.