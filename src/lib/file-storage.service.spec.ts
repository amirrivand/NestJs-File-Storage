import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FileStorageService } from './file-storage.service';
import { StorageConfig } from '../types/storage-config.type';

const mockDriver = {
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  copy: jest.fn(),
  move: jest.fn(),
  makeDirectory: jest.fn(),
  deleteDirectory: jest.fn(),
  getMetadata: jest.fn(),
  url: jest.fn(),
};

const config: StorageConfig = {
  default: 'local',
  disks: {
    local: {
      driver: 'local',
      root: '/tmp',
    },
  },
};

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: 'STORAGE_CONFIG', useValue: config },
      ],
    }).compile();
    service = module.get<FileStorageService>(FileStorageService);
    // Patch the disk method to always return the mockDriver
    jest.spyOn(service, 'disk').mockImplementation(() => mockDriver as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call put on the driver', async () => {
    await service.put('file.txt', Buffer.from('data'));
    expect(mockDriver.put).toHaveBeenCalledWith('file.txt', Buffer.from('data'), undefined);
  });

  it('should call get on the driver', async () => {
    await service.get('file.txt');
    expect(mockDriver.get).toHaveBeenCalledWith('file.txt');
  });

  it('should call delete on the driver', async () => {
    await service.delete('file.txt');
    expect(mockDriver.delete).toHaveBeenCalledWith('file.txt');
  });

  it('should call exists on the driver', async () => {
    await service.exists('file.txt');
    expect(mockDriver.exists).toHaveBeenCalledWith('file.txt');
  });

  it('should call copy on the driver', async () => {
    await service.copy('a.txt', 'b.txt');
    expect(mockDriver.copy).toHaveBeenCalledWith('a.txt', 'b.txt');
  });

  it('should call move on the driver', async () => {
    await service.move('a.txt', 'b.txt');
    expect(mockDriver.move).toHaveBeenCalledWith('a.txt', 'b.txt');
  });

  it('should call makeDirectory on the driver', async () => {
    await service.makeDirectory('dir');
    expect(mockDriver.makeDirectory).toHaveBeenCalledWith('dir');
  });

  it('should call deleteDirectory on the driver', async () => {
    await service.deleteDirectory('dir');
    expect(mockDriver.deleteDirectory).toHaveBeenCalledWith('dir');
  });

  it('should call getMetadata on the driver', async () => {
    await service.getMetadata('file.txt');
    expect(mockDriver.getMetadata).toHaveBeenCalledWith('file.txt');
  });

  it('should call url on the driver', async () => {
    await service.url('file.txt');
    expect(mockDriver.url).toHaveBeenCalledWith('file.txt');
  });
});