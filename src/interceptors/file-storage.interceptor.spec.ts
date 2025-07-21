import 'reflect-metadata';
import { FileStorageInterceptor } from './file-storage.interceptor';
import { FileStorageService } from '../lib/file-storage.service';
import { CallHandler, ExecutionContext } from '@nestjs/common';

describe('FileStorageInterceptor', () => {
  let interceptor: FileStorageInterceptor;
  let storage: any;
  let next: CallHandler;

  beforeEach(() => {
    storage = { disk: jest.fn().mockReturnThis(), put: jest.fn() };
    next = { handle: jest.fn() } as any;
    interceptor = new FileStorageInterceptor(storage, 'local');
  });

  it('should store file if present', async () => {
    const req: any = { file: { originalname: 'a.txt', buffer: Buffer.from('a') } };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    await interceptor.intercept(ctx, next);
    expect(storage.disk).toHaveBeenCalledWith('local');
    expect(storage.put).toHaveBeenCalledWith('a.txt', Buffer.from('a'), undefined);
    expect(req.file.storagePath).toBe('a.txt');
  });

  it('should not fail if no file present', async () => {
    const req: any = {};
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    await interceptor.intercept(ctx, next);
    expect(storage.disk).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });
});