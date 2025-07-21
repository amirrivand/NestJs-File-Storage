import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type FilePermissionPolicy = (
  context: ExecutionContext,
  filePath: string,
  disk: string,
) => Promise<boolean> | boolean;

export const FILE_PERMISSION_POLICY_KEY = 'filePermissionPolicy';
export const FilePermissionPolicy = (policy: FilePermissionPolicy) =>
  SetMetadata(FILE_PERMISSION_POLICY_KEY, policy);

@Injectable()
export class FilePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const filePath =
      request.params?.path || request.body?.path || request.query?.path;
    const disk =
      request.params?.disk ||
      request.body?.disk ||
      request.query?.disk ||
      'default';
    const policy = this.reflector.getAllAndOverride<FilePermissionPolicy>(
      FILE_PERMISSION_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (policy) {
      return await policy(context, filePath, disk);
    }
    // Default: allow all
    return true;
  }
}
