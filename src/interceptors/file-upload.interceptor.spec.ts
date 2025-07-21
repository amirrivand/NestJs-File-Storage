import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FileUploadInterceptor, FileUploadInterceptorOptions } from './file-upload.interceptor';
import { FileStorageService } from '../lib/file-storage.service';
import { CallHandler, ExecutionContext, BadRequestException } from '@nestjs/common';

const mockStorage = {
  disk: jest.fn().mockReturnThis(),
  put: jest.fn(),
  exists: jest.fn(),
  config: {},
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
  let storage: any;

  beforeEach(() => {
    storage = { ...mockStorage };
    jest.clearAllMocks();
  });

  it('should upload a single file to default path', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local' };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'a.txt', buffer: Buffer.from('a') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(storage.disk).toHaveBeenCalledWith('local');
    expect(storage.put).toHaveBeenCalledWith('a.txt', Buffer.from('a'));
    expect(req.uploadedFile).toBeDefined();
  });

  it('should upload a file to a static uploadPath', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local', uploadPath: 'avatars' };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'b.txt', buffer: Buffer.from('b') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(storage.put).toHaveBeenCalledWith('avatars/b.txt', Buffer.from('b'));
  });

  it('should upload a file to a dynamic uploadPath (function)', async () => {
    const options: FileUploadInterceptorOptions = {
      fieldName: 'file',
      disk: 'local',
      uploadPath: jest.fn().mockResolvedValue('users/42'),
    };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'c.txt', buffer: Buffer.from('c') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(options.uploadPath).toHaveBeenCalled();
    expect(storage.put).toHaveBeenCalledWith('users/42/c.txt', Buffer.from('c'));
  });

  it('should merge root and uploadPath', async () => {
    storage.config = { disks: { local: { root: 'base' } } };
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local', uploadPath: 'avatars' };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'd.txt', buffer: Buffer.from('d') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(storage.put).toHaveBeenCalledWith('base/avatars/d.txt', Buffer.from('d'));
  });

  it('should use per-upload filenameGenerator if provided', async () => {
    const options: FileUploadInterceptorOptions = {
      fieldName: 'file',
      disk: 'local',
      filenameGenerator: jest.fn().mockResolvedValue('custom.txt'),
    };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'e.txt', buffer: Buffer.from('e') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(options.filenameGenerator).toHaveBeenCalled();
    expect(storage.put).toHaveBeenCalledWith('custom.txt', Buffer.from('e'));
  });

  it('should use global filenameGenerator if per-upload is not provided', async () => {
    const globalFilenameGenerator = jest.fn().mockResolvedValue('global.txt');
    storage.config = { filenameGenerator: globalFilenameGenerator };
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local' };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'f.txt', buffer: Buffer.from('f') }; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(globalFilenameGenerator).toHaveBeenCalled();
    expect(storage.put).toHaveBeenCalledWith('global.txt', Buffer.from('f'));
  });

  it('should use default logic if no filenameGenerator is provided', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local' };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { req.file = { originalname: 'g.txt', buffer: Buffer.from('g') }; cb(); } };
    storage.exists = jest.fn().mockResolvedValueOnce(false);
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(storage.put).toHaveBeenCalledWith('g.txt', Buffer.from('g'));
  });

  it('should upload multiple files', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'files', disk: 'local', isArray: true };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { array: () => (req: any, _res: any, cb: any) => { req.files = [
      { originalname: 'h.txt', buffer: Buffer.from('h') },
      { originalname: 'i.txt', buffer: Buffer.from('i') }
    ]; cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await interceptor.intercept(ctx, next);
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(req.uploadedFiles.length).toBe(2);
  });

  it('should throw if no file uploaded', async () => {
    const options: FileUploadInterceptorOptions = { fieldName: 'file', disk: 'local' };
    interceptor = new FileUploadInterceptor(storage, options);
    (interceptor as any).upload = { single: () => (req: any, _res: any, cb: any) => { cb(); } };
    const req: any = {};
    const ctx = mockContext(req) as any;
    await expect(interceptor.intercept(ctx, next)).rejects.toThrow(BadRequestException);
  });
});