import 'express';

declare global {
  namespace Express {
    interface Request {
      uploadedFiles?: StoredFile[];
      uploadedFile?: StoredFile;
    }
  }
}

export interface StoredFile extends Omit<Express.Multer.File, 'destination' | 'path'> {
  storagePath: string;
  disk: string;
}
