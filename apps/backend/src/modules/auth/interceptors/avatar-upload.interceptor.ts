import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import {
  AVATAR_ERROR_MESSAGES,
  AVATAR_MAX_SIZE_BYTES,
  isAllowedAvatarMimeType,
} from '../utils/avatar-upload.util';

function isMulterUploadError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('LIMIT_')
  );
}

/**
 * Maps a multipart upload failure to a stable 4xx response. Multer is resolved
 * through two package versions (1.x directly, 2.x via @nestjs/platform-express),
 * so the error is recognised by its code rather than by `instanceof`.
 */
export function toAvatarUploadException(error: unknown): unknown {
  if (error instanceof HttpException || !isMulterUploadError(error)) {
    return error;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return new PayloadTooLargeException(AVATAR_ERROR_MESSAGES.FILE_TOO_LARGE);
  }

  return new BadRequestException(AVATAR_ERROR_MESSAGES.INVALID_REQUEST);
}

/**
 * Multipart handling for `POST /auth/profile/avatar`: caps the payload at the
 * documented avatar size limit, rejects unsupported declared MIME types early
 * and normalises multipart failures into 4xx responses.
 */
@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor;

  constructor() {
    this.delegate = new (FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_SIZE_BYTES, files: 1 },
      fileFilter: (_req, file, callback) => {
        // Cheap pre-check only; the authoritative check sniffs the buffer
        // content in the service before anything is uploaded.
        if (!isAllowedAvatarMimeType(file.mimetype)) {
          callback(
            new BadRequestException(AVATAR_ERROR_MESSAGES.UNSUPPORTED_TYPE),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }))();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const result = this.delegate.intercept(context, next) as
      | Observable<unknown>
      | Promise<Observable<unknown>>;
    const source =
      result instanceof Promise
        ? from(result).pipe(switchMap((inner) => inner))
        : result;

    return source.pipe(
      catchError((error: unknown) =>
        throwError(() => toAvatarUploadException(error)),
      ),
    );
  }
}
