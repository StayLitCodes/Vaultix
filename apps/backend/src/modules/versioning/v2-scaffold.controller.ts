import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * V2 API scaffold controller.
 *
 * This controller defines the structure for the v2 API.
 * Endpoints here are placeholders and will be implemented when v2 launches.
 *
 * V2 Design Goals:
 * - Pagination: cursor-based instead of offset-based
 * - Envelope responses: { data, meta, links }
 * - Filtering: standardized query param format
 * - Error format: RFC 7807 Problem Details
 * - HATEOAS links for related resources
 *
 * To activate v2, uncomment the version in the controller decorator
 * and implement the endpoints.
 */
@ApiTags('v2 (scaffold)')
@Controller({ path: 'escrows', version: '2' })
export class EscrowV2Controller {
  private readonly logger = new Logger(EscrowV2Controller.name);

  @Get()
  @ApiOperation({
    summary: '[V2 Scaffold] List escrows with cursor pagination',
    description:
      'Placeholder for v2 escrow listing with cursor-based pagination, envelope responses, and standardized filtering.',
  })
  listEscrows() {
    this.logger.warn('V2 escrow list endpoint accessed (scaffold only)');
    return {
      data: [],
      meta: {
        cursor: null,
        limit: 20,
        hasMore: false,
      },
      links: {
        self: '/v2/escrows',
        next: null,
      },
    };
  }
}

@ApiTags('v2 (scaffold)')
@Controller({ path: 'auth', version: '2' })
export class AuthV2Controller {
  private readonly logger = new Logger(AuthV2Controller.name);

  @Get('status')
  @ApiOperation({
    summary: '[V2 Scaffold] Auth status',
    description:
      'Placeholder for v2 auth status endpoint with RFC 7807 error format.',
  })
  authStatus() {
    this.logger.warn('V2 auth status endpoint accessed (scaffold only)');
    return {
      data: {
        version: '2.0.0-scaffold',
        status: 'not_implemented',
      },
    };
  }
}

@ApiTags('v2 (scaffold)')
@Controller({ path: 'notifications', version: '2' })
export class NotificationsV2Controller {
  private readonly logger = new Logger(NotificationsV2Controller.name);

  @Get()
  @ApiOperation({
    summary: '[V2 Scaffold] List notifications',
    description:
      'Placeholder for v2 notifications with cursor pagination and batch operations.',
  })
  listNotifications() {
    this.logger.warn('V2 notifications list endpoint accessed (scaffold only)');
    return {
      data: [],
      meta: {
        cursor: null,
        limit: 20,
        hasMore: false,
      },
    };
  }
}
