import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../user/entities/user-role.enum';

interface AuthenticatedUser {
  userId: string;
  walletAddress: string;
  role: UserRole;
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request['user'];

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super-admin access required. Your current role does not grant permission to this resource.',
      );
    }

    return true;
  }
}
