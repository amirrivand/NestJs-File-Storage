import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectAclCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3DiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { PassThrough, Readable } from 'stream';

export class S3StorageDriver implements StorageDriver {
  private s3Client: S3Client;
  private bucket: string;
  private cdnBaseUrl: string;

  constructor(private config: S3DiskConfig) {
    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
      endpoint: config.endpoint,
      apiVersion: 'v3',
    });
    this.bucket = config.bucket;
    this.cdnBaseUrl = config.cdnBaseUrl || '';
  }

  async put(
    path: string,
    content: Buffer | string,
    options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: content,
        ACL: options?.visibility === 'public' ? 'public-read' : 'private',
      }),
    );
  }

  async setVisibility(
    path: string,
    visibility: 'public' | 'private',
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        ACL: visibility === 'public' ? 'public-read' : 'private',
        Body: '', // S3 requires Body, but this will not overwrite content
      }),
    );
  }

  async getVisibility(path: string): Promise<'public' | 'private' | undefined> {
    const response = await this.s3Client.send(
      new GetObjectAclCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
    const grants = response.Grants || [];
    for (const grant of grants) {
      if (
        grant.Permission === 'READ' &&
        grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers'
      ) {
        return 'public';
      }
    }
    return 'private';
  }

  async get(path: string): Promise<Buffer> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
    const stream = response.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(path: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: path,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    await this.s3Client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `/${this.bucket}/${src}`,
        Key: dest,
      }),
    );
  }

  async move(src: string, dest: string): Promise<void> {
    await this.copy(src, dest);
    await this.delete(src);
  }

  async makeDirectory(): Promise<void> {
    // S3 is flat, but we can create a placeholder object
    // Not required for S3, so this is a no-op
  }

  async deleteDirectory(prefix: string): Promise<void> {
    const files = await this.listFiles(prefix);
    for (const file of files) {
      await this.delete(file);
    }
  }

  async getMetadata(path: string): Promise<FileMetadata> {
    const response = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
    return {
      path,
      size: response.ContentLength || 0,
      mimeType: response.ContentType,
      lastModified: response.LastModified,
      visibility: await this.getVisibility(path),
    };
  }

  async listFiles(prefix?: string): Promise<string[]> {
    const response = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }),
    );
    return (
      (response.Contents as { Key: string }[])
        ?.map((item) => item.Key)
        .filter((key): key is string => key !== undefined) || []
    );
  }

  async listDirectories(prefix = '', recursive = true): Promise<string[]> {
    const response = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: '/',
      }),
    );
    let dirs: string[] = [];
    if (response.CommonPrefixes) {
      dirs = response.CommonPrefixes.map((cp) => cp.Prefix || '').filter(
        Boolean,
      );
    }
    if (recursive && dirs.length > 0) {
      for (const dir of dirs) {
        const subdirs = await this.listDirectories(dir, true);
        dirs = dirs.concat(subdirs);
      }
    }
    return dirs;
  }

  async url(path: string): Promise<string> {
    return this.cdnBaseUrl ? `${this.cdnBaseUrl}/${path}` : path;
  }

  /**
   * Generate a temporary (signed) URL for an S3 file. Only expiration is supported; IP/device restriction is not supported by AWS S3.
   * @param path File path
   * @param expiresIn Expiration in seconds (default: 3600)
   * @param options Optional { ip, deviceId } (not supported)
   * @returns Signed temporary URL
   */
  async getTemporaryUrl(
    path: string,
    expiresIn: number = 3600,
    options?: { ip?: string; deviceId?: string }
  ): Promise<string> {
    if (options?.ip || options?.deviceId) {
      throw new Error('IP/device restriction is not supported for S3 temporary URLs');
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async prepend(path: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(path);
    } catch {
      // If file does not exist, treat as empty
    }
    let newContent: Buffer;
    if (Buffer.isBuffer(content)) {
      newContent = Buffer.concat([content, existing]);
    } else {
      newContent = Buffer.concat([Buffer.from(content), existing]);
    }
    await this.put(path, newContent);
  }

  async append(path: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(path);
    } catch {
      // If file does not exist, treat as empty
    }
    let newContent: Buffer;
    if (Buffer.isBuffer(content)) {
      newContent = Buffer.concat([existing, content]);
    } else {
      newContent = Buffer.concat([existing, Buffer.from(content)]);
    }
    await this.put(path, newContent);
  }

  createReadStream(path: string): Readable {
    const pass = new PassThrough();
    this.s3Client
      .send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: path,
        }),
      )
      .then((response) => {
        const s3Stream = response.Body as Readable;
        s3Stream.pipe(pass);
      })
      .catch((err) => {
        pass.emit('error', err);
      });
    return pass;
  }
}
