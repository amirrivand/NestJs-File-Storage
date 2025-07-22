import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

/**
 * Exception filter for file storage errors.
 * Catches errors and returns a standardized JSON response.
 */
@Catch(Error)
export class FileStorageExceptionFilter implements ExceptionFilter {
  /**
   * Handles exceptions thrown in file storage operations.
   * @param exception The error thrown.
   * @param host The arguments host.
   */
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    response.status(500).json({
      statusCode: 500,
      message: exception.message,
      error: 'FileStorageError',
    });
  }
}
