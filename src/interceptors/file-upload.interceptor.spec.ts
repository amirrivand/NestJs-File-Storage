import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FileUploadInterceptor, FileUploadInterceptorOptions } from './file-upload.interceptor';
import { FileStorageService } from '../lib/file-storage.service';
import { CallHandler, ExecutionContext, BadRequestException } from '@nestjs/common';

const mockStorage = {
  disk: jest.fn().mockReturnThis(),
  put: jest.fn(),
};

const mockContext = (fileOrFiles: any) => ({
  switchToHttp: () => ({
    getRequest: () => fileOrFiles,
    getResponse: () => ({}),
  }),
});

const next: CallHandler = { handle: jest.fn(() => 'next') } as any;

describe('FileUploadInterceptor', () => {
  let interceptor: FileUploadInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload a single file', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local' };
    interceptor = new FileUploadInterceptor(mockStorage as any, options);
    // Patch multer upload.single to just assign req.file
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'a.txt', buffer: Buffer.from('a') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(mockStorage.disk).toHaveBeenCalledWith('local');
    expect(mockStorage.put).toHaveBeenCalledWith('a.txt', Buffer.from('a'));
    expect(req.uploadedFile).toBeDefined();
  });

  it('should upload multiple files', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'files', disk: 'local', isArray: true };
    interceptor = new FileUploadInterceptor(mockStorage as any, options);
    (interceptor as any).upload = { array: () => (req: any, _res: any, cb: any) => { req.files = [{ originalname: 'a.txt', buffer: Buffer.from('a') }, { originalname: 'b.txt', buffer: Buffer.from('b') }]; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(mockStorage.disk).toHaveBeenCalledWith('local');
    expect(mockStorage.put).toHaveBeenCalledTimes(2);
    expect(req.uploadedFiles.length).toBe(2);
  });

  it('should throw if no file uploaded', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local' };
    interceptor = new FileUploadInterceptor(mockStorage as any, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await expect(interceptor.intercept(ctx, next)).rejects.toThrow(BadRequestException);
  });

  it('should run validators', async () => {
    const validator = { transform: jest.fn() };
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local', validators: [validator] };
    interceptor = new FileUploadInterceptor(mockStorage as any, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'a.txt', buffer: Buffer.from('a') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(validator.transform).toHaveBeenCalled();
  });
});