import { PassThrough, Readable, Stream, Writable } from 'node:stream';
import mime from 'mime-types';
import tus from 'tus-js-client';
import { Connection } from '../connection.js';
import { FileSystemError } from '../errors.js';
import FileSystem, { FileStats, StreamResult } from './fs.js';

// Constants
const EMPTY_FOLDER_PLACEHOLDER = '.emptyFolderPlaceholder';
const DEFAULT_LIST_LIMIT = 1000;
const DIRECTORY_SEARCH_LIMIT = 100;
const SIGNED_URL_VALIDITY_SECONDS = 30;
const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB
const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/;
const INVALID_CHARS_REGEX = /[<>:"|?*\x00-\x1f]/;

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
    this.bucketName = this._root;
    this.bucketPrefix = segments.slice(1).join('/');
  }

  // Helper methods for DRY
  private get storage() {
    return this.connection.server.supabase.storage.from(this.bucketName);
  }

  private createDate(item: { updated_at?: string; created_at?: string }): Date {
    return new Date(item.updated_at ?? item.created_at ?? Date.now());
  }

  private isEmptyFolderPlaceholder = (item: { name: string }): boolean =>
    item.name === EMPTY_FOLDER_PLACEHOLDER;

  private createFileStats(
    name: string,
    item: any,
    isDirectory: boolean,
    customMtime?: Date
  ): FileStats {
    const mtime = customMtime ?? this.createDate(item);
    const mode = isDirectory ? 0o755 : 0o644;

    return {
      name,
      size: item.metadata?.size ?? 0,
      mtime,
      mode,
      mediaType: item.metadata?.mimetype,
      isDirectory: () => isDirectory,
      isFile: () => !isDirectory,
    };
  }

  private async findPlaceholderFile(fsPath: string) {
    try {
      const { data, error } = await this.storage.list(fsPath || undefined, {
        limit: DEFAULT_LIST_LIMIT,
        search: EMPTY_FOLDER_PLACEHOLDER,
      });

      return error || !data?.length
        ? null
        : (data.find(this.isEmptyFolderPlaceholder) ?? null);
    } catch {
      return null;
    }
  }

  private async createEmptyFolderPlaceholder(fsPath: string): Promise<void> {
    const { error } = await this.storage.upload(
      `${fsPath}/${EMPTY_FOLDER_PLACEHOLDER}`,
      new Uint8Array(0),
      { contentType: 'application/octet-stream', upsert: true }
    );

    if (error) throw new Error(`Failed to create directory: ${error.message}`);
  }

  protected normalizePath(path: string): string {
    return path
      .replace(/[/\\]+/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .trim();
  }

  protected resolveRootPath(root?: string): string {
    const trimmedRoot = root?.trim();
    if (!trimmedRoot || trimmedRoot === '/') {
      throw new Error(
        "Invalid bucket name: root cannot be empty, '/', or whitespace"
      );
    }

    const bucketName = this.normalizePath(trimmedRoot).split('/')[0];

    if (!bucketName || !BUCKET_NAME_REGEX.test(bucketName)) {
      throw new Error(
        'Invalid bucket name: must contain only lowercase letters, numbers, hyphens, and underscores, start and end with alphanumeric characters'
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
    if (path === '/') return (this.cwd = '/');

    const { clientPath, fsPath } = this._resolvePath(path);

    if (clientPath === '/' || !fsPath || fsPath === this.bucketPrefix) {
      return (this.cwd = '/');
    }

    if (INVALID_CHARS_REGEX.test(fsPath)) {
      throw new Error('Invalid directory name: contains invalid characters');
    }

    const { data, error } = await this.storage.list(fsPath, { limit: 1 });

    if (error || !data?.length) {
      throw new Error(
        `Directory does not exist or is not accessible${error ? `: ${error.message}` : ''}`
      );
    }

    return (this.cwd = clientPath);
  }

  async list(path = '.', { showHidden = false }): Promise<FileStats[]> {
    const { fsPath } = this._resolvePath(path);

    const { data, error } = await this.storage.list(fsPath, {
      limit: DEFAULT_LIST_LIMIT,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw new Error(`Failed to list directory: ${error.message}`);
    if (!data) return [];

    const subdirectories = data.filter(
      item => !item.metadata && !this.isEmptyFolderPlaceholder(item)
    );
    const directoryMtimes = await this.getDirectoryMtimes(
      fsPath,
      subdirectories
    );

    return data
      .filter(item => showHidden || !item.name.startsWith('.'))
      .map(item => {
        const isDirectory = !item.metadata;
        const dirMtime = isDirectory
          ? directoryMtimes.get(item.name)
          : undefined;
        return this.createFileStats(item.name, item, isDirectory, dirMtime);
      });
  }

  private async getDirectoryMtimes(
    fsPath: string,
    subdirectories: any[]
  ): Promise<Map<string, Date>> {
    if (!subdirectories.length) return new Map();

    const mtimePromises = subdirectories.map(async dir => {
      const directoryPath = fsPath ? `${fsPath}/${dir.name}` : dir.name;

      try {
        const { data } = await this.storage.list(directoryPath, {
          limit: DIRECTORY_SEARCH_LIMIT,
          search: EMPTY_FOLDER_PLACEHOLDER,
        });

        const placeholderFile = data?.find(this.isEmptyFolderPlaceholder);
        return {
          name: dir.name,
          mtime: placeholderFile
            ? this.createDate(placeholderFile)
            : new Date(),
        };
      } catch (error) {
        console.debug(
          `Could not get ${EMPTY_FOLDER_PLACEHOLDER} file for directory ${dir.name}:`,
          error
        );
        return { name: dir.name, mtime: new Date() };
      }
    });

    const mtimes = await Promise.all(mtimePromises);
    return new Map(mtimes.map(({ name, mtime }) => [name, mtime]));
  }

  async get(fileName: string): Promise<FileStats> {
    const { fsPath } = this._resolvePath(fileName);

    if (fileName === '.' || fileName === '' || fileName === '/') {
      return this.createFileStats('.', { metadata: null }, true, new Date());
    }

    const parentPath = fsPath.split('/').slice(0, -1).join('/') || undefined;
    const { data: fileData, error: fileError } = await this.storage.list(
      parentPath,
      {
        limit: DEFAULT_LIST_LIMIT,
        search: fsPath.split('/').pop(),
      }
    );

    if (fileError)
      throw new Error(`Failed to get file info: ${fileError.message}`);

    const file = fileData?.find(item => item.name === fsPath.split('/').pop());
    if (file) {
      return this.createFileStats(file.name, file, !file.metadata);
    }

    const placeholderFile = await this.findPlaceholderFile(fsPath);
    if (placeholderFile) {
      return this.createFileStats(
        fileName.split('/').pop() ?? fileName,
        placeholderFile,
        true,
        this.createDate(placeholderFile)
      );
    }

    throw new FileSystemError(`File or directory not found: ${fileName}`);
  }

  private async _downloadFile(
    fsPath: string,
    stream: Writable,
    start?: number
  ) {
    const emitError = (message: string) => {
      if (!stream.destroyed) {
        stream.emit('error', new Error(message));
      }
    };

    try {
      const { data: signedUrlData, error: signedUrlError } =
        await this.storage.createSignedUrl(fsPath, SIGNED_URL_VALIDITY_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        const message = signedUrlError
          ? `Failed to get signed URL: ${signedUrlError.message}`
          : 'No signed URL received';
        console.error(
          'Signed URL error for path:',
          fsPath,
          'Error:',
          signedUrlError
        );
        emitError(message);
        return;
      }

      const options: RequestInit =
        start && start > 0 ? { headers: { Range: `bytes=${start}-` } } : {};

      const response = await fetch(signedUrlData.signedUrl, options);

      if (!response.ok && response.status !== 206) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(
          'Download failed for path:',
          fsPath,
          'Status:',
          response.status,
          'Error:',
          errorText
        );
        emitError(
          `Failed to download file: ${response.status} ${response.statusText}`
        );
        return;
      }

      if (!response.body) {
        emitError('Response body is null');
        return;
      }

      const readable = Readable.fromWeb(response.body);

      readable.pipe(stream, { end: false });

      readable.on('end', () => {
        if (!stream.destroyed) {
          stream.end();
        }
      });

      readable.on('error', error => {
        console.error('Stream error:', error);
        emitError(`Stream error: ${error.message}`);
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      emitError(
        `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  read(fileName: string, options?: { start?: number }): StreamResult {
    const { clientPath, fsPath } = this._resolvePath(fileName);
    const stream = new PassThrough({ read() {} });

    this._downloadFile(fsPath, stream, options?.start);

    return { stream, clientPath };
  }

  async write(
    fileName: string,
    options: { append?: boolean; start?: number } = { append: true }
  ): Promise<StreamResult> {
    const { clientPath, fsPath } = this._resolvePath(fileName);
    const pass = new Stream.PassThrough();
    const mediaType = mime.lookup(fileName) ?? 'application/octet-stream';

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
        contentType: mediaType || 'application/octet-stream',
      },
      chunkSize: UPLOAD_CHUNK_SIZE,
      onError: error => {
        console.error('Upload error:', error);
        pass.emit('error', error);
      },
      onSuccess: () => {
        console.log(`File ${fileName} uploaded successfully`);
        pass.end();
      },
    });

    upload.findPreviousUploads().then(previousUploads => {
      if (previousUploads[0])
        upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    });

    return { stream: pass, clientPath };
  }

  async delete(path: string): Promise<void> {
    const { fsPath } = this._resolvePath(path);
    const stats = await this.get(path);

    if (stats.isFile()) {
      const { error } = await this.storage.remove([fsPath]);
      if (error) throw new Error(`Failed to delete file: ${error.message}`);
    } else if (stats.isDirectory()) {
      await this.deleteDirectory(fsPath, path);
    }
  }

  private async deleteDirectory(fsPath: string, path: string): Promise<void> {
    const { data, error } = await this.storage.list(fsPath, {
      limit: DEFAULT_LIST_LIMIT,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw new Error(`Failed to list directory contents: ${error.message}`);
    }

    if (data && data.length > 0) {
      const filesToDelete = data
        .filter(item => item.metadata)
        .map(file => `${fsPath}/${file.name}`);

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await this.storage.remove(filesToDelete);

        if (deleteError) {
          throw new Error(
            `Failed to delete files in directory: ${deleteError.message}`
          );
        }
      }

      await Promise.all(
        data
          .filter(item => !item.metadata)
          .map(item => this.delete(`${path}/${item.name}`))
      );
    }
  }

  async mkdir(path: string): Promise<string> {
    const { clientPath, fsPath } = this._resolvePath(path);
    await this.createEmptyFolderPlaceholder(fsPath);
    return clientPath;
  }

  async rename(from: string, to: string): Promise<void> {
    const { fsPath: fromFsPath } = this._resolvePath(from);
    const { fsPath: toFsPath } = this._resolvePath(to);
    const stats = await this.get(from);

    if (stats.isFile()) {
      const { error } = await this.storage.move(fromFsPath, toFsPath);
      if (error) throw new Error(`Failed to move file: ${error.message}`);
    } else if (stats.isDirectory()) {
      try {
        await this.get(to);
        await this.delete(to);
      } catch (error) {
        if (!(error instanceof FileSystemError)) throw error;
      }

      await this._moveDirectory(fromFsPath, toFsPath);
    } else {
      throw new Error(`Unknown file type for ${from}`);
    }
  }

  private async _moveDirectory(
    fromPath: string,
    toPath: string
  ): Promise<void> {
    try {
      const { data: files, error: listError } = await this.storage.list(
        fromPath,
        {
          limit: DEFAULT_LIST_LIMIT,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        }
      );

      if (listError) {
        throw new Error(
          `Failed to list source directory: ${listError.message}`
        );
      }

      if (!files || files.length === 0) return;

      await this.createEmptyFolderPlaceholder(toPath);

      const filesToMove = files.filter(
        file => !this.isEmptyFolderPlaceholder(file)
      );

      for (const file of filesToMove) {
        const sourceItemPath = `${fromPath}/${file.name}`;
        const destItemPath = `${toPath}/${file.name}`;

        if (file.metadata) {
          const { error: moveError } = await this.storage.move(
            sourceItemPath,
            destItemPath
          );

          if (moveError) {
            throw new Error(
              `Failed to move file ${file.name}: ${moveError.message}`
            );
          }
        } else {
          await this._moveDirectory(sourceItemPath, destItemPath);
        }
      }

      const { error: removeError } = await this.storage.remove([
        `${fromPath}/${EMPTY_FOLDER_PLACEHOLDER}`,
      ]);

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
