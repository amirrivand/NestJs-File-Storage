import 'reflect-metadata';
import { FilePermissionGuard, FILE_PERMISSION_POLICY_KEY } from './file-permission.guard';
import { Reflector } from '@nestjs/core';

describe('FilePermissionGuard', () => {
  let guard: FilePermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new FilePermissionGuard(reflector);
  });

  it('should allow if no policy', async () => {
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should apply policy if present', async () => {
    const policy = jest.fn().mockResolvedValue(false);
    (reflector.getAllAndOverride as any).mockReturnValue(policy);
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({ params: { path: 'a', disk: 'd' } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    expect(await guard.canActivate(ctx)).toBe(false);
    expect(policy).toHaveBeenCalled();
  });
});