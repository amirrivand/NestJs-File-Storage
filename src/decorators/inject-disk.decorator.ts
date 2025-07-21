import { Inject } from '@nestjs/common';

export function InjectDisk(diskName: string) {
  return Inject(`FILE_STORAGE_DISK_${diskName.toUpperCase()}`);
}
