/**
 * Custom error class for file storage-related errors.
 * Extends the standard Error class with an optional error code.
 */
export class FileStorageError extends Error {
  /**
   * Create a new FileStorageError.
   * @param message The error message.
   * @param code Optional error code.
   */
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}
