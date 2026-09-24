<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Security Headers

The backend uses [Helmet](https://helmetjs.github.io/) to automatically set security-related HTTP headers on all responses. Since this is an API-only server (no HTML serving), headers are tuned accordingly.

### Headers Configured

| Header                      | Value                                        | Purpose                                          |
| --------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `X-Frame-Options`           | `DENY`                                       | Prevents clickjacking by disallowing framing     |
| `X-Content-Type-Options`    | `nosniff`                                    | Prevents MIME-type sniffing                      |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`        | Enforces HTTPS (HSTS)                            |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`            | Controls referrer information sent with requests |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self'; ...` | Restricts resource loading to same origin        |
| `X-XSS-Protection`          | _(disabled)_                                 | Modern browsers use CSP instead                  |

### CORS Configuration

CORS origins are configurable via the `CORS_ORIGINS` environment variable (comma-separated list). Defaults to `http://localhost:3000,http://localhost:3001` for local development.

```env
CORS_ORIGINS=https://app.vaultix.io,https://admin.vaultix.io
```

## Admin Role Hierarchy

The backend implements a three-tier role system enforced via JWT authentication and guard middleware.

### Roles

| Role          | Description                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `USER`        | Default role for all registered users. Can create/manage own escrows.                                          |
| `ADMIN`       | Platform administrators. Access to admin dashboard, escrow management, user management, audit logs, analytics. |
| `SUPER_ADMIN` | Highest privilege level. Includes all ADMIN capabilities plus user role management (promote/demote).           |

### Guard Chain

All admin endpoints require **both** guards in sequence:

```
@UseGuards(AuthGuard, AdminGuard)   // ADMIN or SUPER_ADMIN
@UseGuards(AuthGuard, SuperAdminGuard)  // SUPER_ADMIN only
```

- **AuthGuard** — validates JWT, looks up user from DB, attaches `{ userId, walletAddress, role }` to request. Rejects suspended accounts.
- **AdminGuard** — verifies `role` is `ADMIN` or `SUPER_ADMIN`. Returns `403` with clear message otherwise.
- **SuperAdminGuard** — verifies `role` is `SUPER_ADMIN`. Returns `403` with clear message otherwise.

### Role Management Endpoints (Super-Admin Only)

| Method | Endpoint                      | Description                                       |
| ------ | ----------------------------- | ------------------------------------------------- |
| `POST` | `/v1/admin/users/:id/promote` | Promote user to ADMIN. Requires `reason` in body. |
| `POST` | `/v1/admin/users/:id/demote`  | Demote user to USER. Requires `reason` in body.   |
| `GET`  | `/v1/admin/users/:id/roles`   | View role change history for a user.              |

### Safety Rules

- Cannot promote or demote your own account
- Cannot demote the last remaining super-admin
- All role changes require a `reason` (max 500 chars) for audit trail
- Every role change is logged in `admin_audit_log` with actor ID, action type, old/new role, and reason

## Database Migrations

This project uses TypeORM migrations for database schema management.

```bash
# Generate a new migration based on entity changes
$ npm run migration:generate -- src/migrations/MigrationName

# Execute pending migrations
$ npm run migration:run

# Rollback the last executed migration
$ npm run migration:revert

# List all migrations and their status
$ npm run migration:show
```

Note: In development, `synchronize: false` is set to ensure schema changes are always handled via migrations. Migrations run automatically on application startup (`migrationsRun: true`).

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
