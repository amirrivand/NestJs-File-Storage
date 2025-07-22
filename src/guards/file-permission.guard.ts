import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Type for file permission policy functions.
 * Used to determine if a file operation is allowed.
 */
export type FilePermissionPolicy = (
  context: ExecutionContext,
  filePath: string,
  disk: string,
) => Promise<boolean> | boolean;

export const FILE_PERMISSION_POLICY_KEY = 'filePermissionPolicy';
/**
 * Decorator to set a file permission policy on a route or controller.
 * @param policy The file permission policy function.
 * @returns A custom metadata decorator.
 */
export const FilePermissionPolicy = (policy: FilePermissionPolicy) =>
  SetMetadata(FILE_PERMISSION_POLICY_KEY, policy);

/**
 * Guard to enforce file permission policies.
 * Checks for a policy and invokes it if present.
 */
@Injectable()
export class FilePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Checks if the current request is allowed by the file permission policy.
   * @param context The execution context.
   * @returns True if allowed, false otherwise.
   */
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
