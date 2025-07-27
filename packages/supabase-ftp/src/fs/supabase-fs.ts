import { PassThrough, Readable, Stream, Writable } from 'node:stream';
import tus from 'tus-js-client';
import { Connection } from '../connection.js';
import FileSystem, { FileStats, StreamResult } from './fs.js';

export default class SupabaseFileSystem extends FileSystem {
  private bucketName: string;
  private bucketPrefix: string;

  constructor(
    connection: Connection,
    options: { root?: string; cwd?: string } = {}
  ) {
    super(connection, options);

    const normalizedRoot = this.normalizePath(options.root || '');
    const segments = normalizedRoot.split('/').filter(Boolean);
    this.bucketName = this._root; // This is already just the bucket name from resolveRootPath
    this.bucketPrefix = segments.slice(1).join('/'); // Everything after the bucket name
  }
  protected normalizePath(path: string): string {
    return path
      .replace(/[/\\]+/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .trim();
  }

  protected resolveRootPath(root?: string): string {
    if (!root || root === '/' || root.trim() === '') {
      throw new Error(
        "Invalid bucket name: root cannot be empty, '/', or whitespace"
      );
    }

    const normalizedRoot = this.normalizePath(root);
    const bucketName = normalizedRoot.split('/')[0];

    if (
      !bucketName ||
      !/^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/.test(bucketName)
    ) {
      throw new Error(
        'Invalid bucket name: must contain only lowercase letters, numbers, hyphens, and underscores, ' +
          'start and end with alphanumeric characters'
      );
    }

    if (bucketName.length < 1 || bucketName.length > 63) {
      throw new Error(
        'Invalid bucket name: must be between 1 and 63 characters long'
      );
    }

    return bucketName;
  }

  protected _resolvePath(dir = '.'): { clientPath: string; fsPath: string } {
    const normalizedDir = this.normalizePath(dir);

    if (normalizedDir === '.' || normalizedDir === '') {
      const fsPath =
        this.cwd === '/'
          ? this.bucketPrefix
          : this.normalizePath(this.cwd.replace(/^\/+/, ''));
      return {
        clientPath: this.cwd,
        fsPath:
          this.bucketPrefix && fsPath && fsPath !== this.bucketPrefix
            ? `${this.bucketPrefix}/${fsPath}`
            : this.bucketPrefix || fsPath,
      };
    }

    let clientPath: string;
    if (dir.startsWith('/')) {
      clientPath = '/' + normalizedDir;
    } else {
      const joinedPath = `${this.cwd}/${normalizedDir}`;
      clientPath = '/' + this.normalizePath(joinedPath);
    }

    const segments = clientPath.split('/').filter(Boolean);
    const safeSegments: string[] = [];

    for (const segment of segments) {
      if (segment === '..') {
        if (safeSegments.length > 0) {
          safeSegments.pop();
        }
      } else if (segment !== '.') {
        safeSegments.push(segment);
      }
    }

    clientPath = '/' + safeSegments.join('/');

    let fsPath = this.normalizePath(clientPath.replace(/^\/+/, ''));
    if (this.bucketPrefix) {
      fsPath = this.bucketPrefix + (fsPath ? '/' + fsPath : '');
    }

    return { clientPath, fsPath };
  }

  async chdir(path = '.'): Promise<string> {
    try {
      if (path === '/') {
        this.cwd = '/';
        return this.cwd;
      }

      const { clientPath, fsPath } = this._resolvePath(path);

      if (clientPath === '/') {
        this.cwd = '/';
        return this.cwd;
      }

      if (!fsPath || fsPath === this.bucketPrefix) {
        this.cwd = '/';
        return this.cwd;
      }

      const invalidChars = /[<>:"|?*\x00-\x1f]/;
      if (invalidChars.test(fsPath)) {
        throw new Error(`Invalid directory name: contains invalid characters`);
      }

      // Verify the directory exists by listing it
      const { data, error } = await this.connection.server.supabase.storage
        .from(this.bucketName)
        .list(fsPath || undefined, {
          limit: 1,
        });

      if (error || !data.length || !data) {
        throw new Error(
          `Directory does not exist or is not accessible${error ? `: ${error.message}` : ''}`
        );
      }

      this.cwd = clientPath;
      return this.cwd;
    } catch (error) {
      throw new Error(
        `Cannot change directory to ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async list(path = '.'): Promise<FileStats[]> {
    try {
      const { fsPath } = this._resolvePath(path);

      const { data, error } = await this.connection.server.supabase.storage
        .from(this.bucketName)
        .list(fsPath || undefined, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) {
        throw new Error(`Failed to list directory: ${error.message}`);
      }

      if (!data) {
        return [];
      }

      return data.map((item): FileStats => {
        const isDirectory = !item.metadata;
        const size = item.metadata?.size || 0;
        const lastModified = new Date(
          item.updated_at || item.created_at || Date.now()
        );

        return {
          name: item.name,
          size: size,
          mtime: lastModified,
          mode: isDirectory ? 0o755 : 0o644, // Directory: 755, File: 644
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        };
      });
    } catch (error) {
      console.error('Error listing directory:', error);
      return [];
    }
  }

  async get(fileName: string): Promise<FileStats> {
    try {
      const { fsPath } = this._resolvePath(fileName);

      const { data: fileData, error: fileError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .list(fsPath.split('/').slice(0, -1).join('/') || undefined, {
            limit: 1000,
            search: fsPath.split('/').pop(),
          });

      if (fileError) {
        throw new Error(`Failed to get file info: ${fileError.message}`);
      }

      const file = fileData?.find(
        item => item.name === fsPath.split('/').pop()
      );

      if (file) {
        const isDirectory = !file.metadata;
        const size = file.metadata?.size || 0;
        const lastModified = new Date(
          file.updated_at || file.created_at || Date.now()
        );

        return {
          name: file.name,
          size: size,
          mtime: lastModified,
          mode: isDirectory ? 0o755 : 0o644,
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        };
      }

      const { data: dirData, error: dirError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .list(fsPath || undefined, {
            limit: 1,
          });

      if (!dirError && dirData) {
        return {
          name: fileName.split('/').pop() || fileName,
          size: 0,
          mtime: new Date(),
          mode: 0o755,
          isDirectory: () => true,
          isFile: () => false,
        };
      }

      throw new Error(`File or directory not found: ${fileName}`);
    } catch (error) {
      throw error;
    }
  }

  private async _downloadFile(
    fsPath: string,
    stream: Writable,
    start?: number
  ) {
    try {
      const { data: signedUrlData, error: signedUrlError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(fsPath, 30); // 30 seconds validity

      if (signedUrlError) {
        stream.emit(
          'error',
          new Error(`Failed to get signed URL: ${signedUrlError.message}`)
        );
        return;
      }

      if (!signedUrlData?.signedUrl) {
        stream.emit('error', new Error('No signed URL received'));
        return;
      }

      const options: RequestInit = {};
      if (start && start > 0) {
        options.headers = {
          Range: `bytes=${start}-`,
        };
      }

      const response = await fetch(signedUrlData.signedUrl, options);

      if (!response.ok && response.status !== 206) {
        stream.emit(
          'error',
          new Error(
            `Failed to download file: ${response.status} ${response.statusText}`
          )
        );
        return;
      }

      if (!response.body) {
        stream.emit('error', new Error('Response body is null'));
        return;
      }

      const nodeStream = Readable.fromWeb(response.body);

      nodeStream.pipe(stream);

      nodeStream.on('error', error => {
        console.error('Stream error:', error);
        stream.emit('error', error);
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      stream.emit('error', error);
    }
  }

  read(fileName: string, options?: { start?: number }): StreamResult {
    const { clientPath, fsPath } = this._resolvePath(fileName);

    const stream = new PassThrough({
      read() {},
    });

    this._downloadFile(fsPath, stream, options?.start).catch(error => {
      stream.emit('error', error);
    });

    return {
      stream,
      clientPath,
    };
  }

  async write(
    fileName: string,
    options: { append?: boolean; start?: number } = { append: true }
  ): Promise<StreamResult> {
    const { clientPath, fsPath } = this._resolvePath(fileName);

    const pass = new Stream.PassThrough();

    const upload = new tus.Upload(pass, {
      endpoint: `${process.env.SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        'x-upsert': options?.append ? 'true' : 'false',
      },
      uploadDataDuringCreation: true,
      uploadLengthDeferred: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: this.bucketName,
        objectName: fsPath,
        contentType: 'application/octet-stream',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      onError: error => {
        console.error('Upload error:', error);
        pass.emit('error', error);
      },
      onSuccess: () => {
        console.log(`File ${fileName} uploaded successfully`);
        pass.end();
      },
    });

    upload.findPreviousUploads().then(function (previousUploads) {
      if (previousUploads[0]) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });

    return {
      stream: pass,
      clientPath,
    };
  }

  async delete(path: string): Promise<void> {
    try {
      const { fsPath } = this._resolvePath(path);

      return this.get(path).then(async stats => {
        if (stats.isFile()) {
          const { error } = await this.connection.server.supabase.storage
            .from(this.bucketName)
            .remove([fsPath]);

          if (error) {
            throw new Error(`Failed to delete file: ${error.message}`);
          }
        } else if (stats.isDirectory()) {
          const { data, error } = await this.connection.server.supabase.storage
            .from(this.bucketName)
            .list(fsPath, {
              limit: 1000,
              offset: 0,
              sortBy: { column: 'name', order: 'asc' },
            });

          if (error) {
            throw new Error(
              `Failed to list directory contents: ${error.message}`
            );
          }

          if (data && data.length > 0) {
            const filesToDelete = data
              .filter(item => item.metadata)
              .map(file => `${fsPath}/${file.name}`);

            if (filesToDelete.length > 0) {
              const { error: deleteError } =
                await this.connection.server.supabase.storage
                  .from(this.bucketName)
                  .remove(filesToDelete);

              if (deleteError) {
                throw new Error(
                  `Failed to delete files in directory: ${deleteError.message}`
                );
              }
            }

            for (const item of data.filter(item => !item.metadata)) {
              await this.delete(`${path}/${item.name}`);
            }
          }
        }

        return Promise.resolve();
      });
    } catch (error) {
      console.error('Error deleting:', error);
      return Promise.reject(error);
    }
  }

  async mkdir(path: string): Promise<string> {
    try {
      const { clientPath, fsPath } = this._resolvePath(path);

      const placeholderPath = `${fsPath}/.emptyFolderPlaceholder`;

      const emptyBuffer = new Uint8Array(0);

      const { error } = await this.connection.server.supabase.storage
        .from(this.bucketName)
        .upload(placeholderPath, emptyBuffer, {
          contentType: 'application/octet-stream',
          upsert: true,
        });

      if (error) {
        throw new Error(`Failed to create directory: ${error.message}`);
      }

      return clientPath;
    } catch (error) {
      console.error('Error creating directory:', error);
      throw new Error(
        `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async rename(from: string, to: string): Promise<void> {
    try {
      const { fsPath: fromFsPath } = this._resolvePath(from);
      const { fsPath: toFsPath } = this._resolvePath(to);

      const stats = await this.get(from);

      if (stats.isFile()) {
        const { error } = await this.connection.server.supabase.storage
          .from(this.bucketName)
          .move(fromFsPath, toFsPath);

        if (error) {
          throw new Error(`Failed to move file: ${error.message}`);
        }
      } else if (stats.isDirectory()) {
        await this._moveDirectory(fromFsPath, toFsPath);
      } else {
        throw new Error(`Unknown file type for ${from}`);
      }
    } catch (error) {
      console.error('Error renaming:', error);
      throw new Error(
        `Failed to rename ${from} to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async _moveDirectory(
    fromPath: string,
    toPath: string
  ): Promise<void> {
    try {
      const placeholderPath = `${toPath}/.emptyFolderPlaceholder`;
      const emptyBuffer = new Uint8Array(0);

      const { error: createError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .upload(placeholderPath, emptyBuffer, {
            contentType: 'application/octet-stream',
            upsert: true,
          });

      if (createError) {
        throw new Error(
          `Failed to create destination directory: ${createError.message}`
        );
      }

      const { data: files, error: listError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .list(fromPath, {
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          });

      if (listError) {
        throw new Error(
          `Failed to list source directory: ${listError.message}`
        );
      }

      if (!files || files.length === 0) return;

      for (const file of files) {
        const sourceItemPath = `${fromPath}/${file.name}`;
        const destItemPath = `${toPath}/${file.name}`;

        if (file.metadata) {
          const { error: moveError } =
            await this.connection.server.supabase.storage
              .from(this.bucketName)
              .move(sourceItemPath, destItemPath);

          if (moveError) {
            throw new Error(
              `Failed to move file ${file.name}: ${moveError.message}`
            );
          }
        } else {
          await this._moveDirectory(sourceItemPath, destItemPath);
        }
      }

      const { error: removeError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .remove([`${fromPath}/.emptyFolderPlaceholder`]);

      if (removeError && !removeError.message.includes('does not exist')) {
        console.warn(
          `Warning: Could not remove source directory placeholder: ${removeError.message}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to move directory from ${fromPath} to ${toPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  chmod(path: string, mode: number): void {
    // Note: Supabase Storage doesn't have native file permissions like Unix systems.
    // This implementation stores the mode as metadata for compatibility with FTP clients
    // that expect chmod to work, but it doesn't enforce actual permissions.

    console.warn(
      `chmod called on ${path} with mode ${mode.toString(8)} (octal). ` +
        'Supabase Storage does not support file permissions. ' +
        'Use Row Level Security (RLS) policies for access control instead.'
    );

    // For FTP compatibility, we could store the mode in a custom metadata table
    // or return success without error to avoid breaking FTP clients that expect chmod to work

    // This is a no-op for now, but could be extended to:
    // 1. Store permissions in a custom metadata table
    // 2. Update file metadata (if supported by the storage backend)
    // 3. Modify RLS policies dynamically (advanced use case)
  }

  getUniqueName(name: string): string {
    const extension = name.includes('.')
      ? name.substring(name.lastIndexOf('.'))
      : '';
    const baseName = name.includes('.')
      ? name.substring(0, name.lastIndexOf('.'))
      : name;
    const randomPart = Math.random().toString(36).substring(2, 15);
    const timestampPart = Date.now().toString(36);
    return `${baseName}_${timestampPart}_${randomPart}${extension}`;
  }
}
