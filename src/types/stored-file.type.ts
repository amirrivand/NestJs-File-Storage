import { Express } from 'express';

export type StoredFile = Express.Multer.File & {
  storagePath: string;
};
