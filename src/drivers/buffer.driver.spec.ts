import { BufferStorageDriver } from './buffer.driver';
import { BufferDiskConfig } from '../lib/file-storage.interface';

describe('BufferStorageDriver', () => {
  let driver: BufferStorageDriver;
  const config: BufferDiskConfig = { driver: 'buffer' };

  beforeEach(() => {
    driver = new BufferStorageDriver(config);
  });

  it('should store and retrieve a file', async () => {
    await driver.put('test.txt', 'hello');
    const data = await driver.get('test.txt');
    expect(data.toString()).toBe('hello');
  });

  it('should return true for exists after put', async () => {
    await driver.put('exists.txt', 'exists');
    expect(await driver.exists('exists.txt')).toBe(true);
  });

  it('should delete a file', async () => {
    await driver.put('delete.txt', 'bye');
    await driver.delete('delete.txt');
    expect(await driver.exists('delete.txt')).toBe(false);
  });

  it('should copy a file', async () => {
    await driver.put('src.txt', 'copy me');
    await driver.copy('src.txt', 'dest.txt');
    expect((await driver.get('dest.txt')).toString()).toBe('copy me');
  });

  it('should move a file', async () => {
    await driver.put('move.txt', 'move me');
    await driver.move('move.txt', 'moved.txt');
    expect(await driver.exists('move.txt')).toBe(false);
    expect((await driver.get('moved.txt')).toString()).toBe('move me');
  });

  it('should append to a file', async () => {
    await driver.put('append.txt', 'foo');
    await driver.append('append.txt', 'bar');
    expect((await driver.get('append.txt')).toString()).toBe('foobar');
  });

  it('should prepend to a file', async () => {
    await driver.put('prepend.txt', 'bar');
    await driver.prepend('prepend.txt', 'foo');
    expect((await driver.get('prepend.txt')).toString()).toBe('foobar');
  });

  it('should list files', async () => {
    await driver.put('a.txt', 'A');
    await driver.put('b.txt', 'B');
    const files = await driver.listFiles();
    expect(files).toEqual(expect.arrayContaining(['a.txt', 'b.txt']));
  });

  it('should throw on get for missing file', async () => {
    await expect(driver.get('missing.txt')).rejects.toThrow('File not found');
  });
}); 