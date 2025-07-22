import 'express';

declare global {
  namespace Express {
    /**
     * Extension of Express.Request to include uploaded file(s) information.
     */
    interface Request {
      uploadedFiles?: StoredFile[];
      uploadedFile?: StoredFile;
    }
  }
}

/**
 * Represents a file stored via the file storage system.
 * Extends Express.Multer.File, omitting destination and path.
 */
export interface StoredFile extends Omit<Express.Multer.File, 'destination' | 'path'> {
  storagePath: string;
  disk: string;
}
