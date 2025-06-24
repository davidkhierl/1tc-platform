import { PassThrough, Readable, Stream, Writable } from "node:stream";
import tus from "tus-js-client";
import { Connection } from "../connection.js";
import FileSystem, { FileStats, StreamResult } from "./fs.js";

export default class SupabaseFileSystem extends FileSystem {
  private bucketName: string;
  private bucketPrefix: string;

  constructor(
    connection: Connection,
    options: { root?: string; cwd?: string } = {}
  ) {
    super(connection, options);

    const normalizedRoot = this.normalizePath(options.root || "");
    const segments = normalizedRoot.split("/").filter(Boolean);
    this.bucketName = this._root; // This is already just the bucket name from resolveRootPath
    this.bucketPrefix = segments.slice(1).join("/"); // Everything after the bucket name
  }
  protected normalizePath(path: string): string {
    return path
      .replace(/[/\\]+/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .trim();
  }

  protected resolveRootPath(root?: string): string {
    if (!root || root === "/" || root.trim() === "") {
      throw new Error(
        "Invalid bucket name: root cannot be empty, '/', or whitespace"
      );
    }

    const normalizedRoot = this.normalizePath(root);
    const bucketName = normalizedRoot.split("/")[0];

    if (
      !bucketName ||
      !/^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/.test(bucketName)
    ) {
      throw new Error(
        "Invalid bucket name: must contain only lowercase letters, numbers, hyphens, and underscores, " +
          "start and end with alphanumeric characters"
      );
    }

    if (bucketName.length < 1 || bucketName.length > 63) {
      throw new Error(
        "Invalid bucket name: must be between 1 and 63 characters long"
      );
    }

    return bucketName;
  }

  protected _resolvePath(dir = "."): { clientPath: string; fsPath: string } {
    const normalizedDir = this.normalizePath(dir);

    if (normalizedDir === "." || normalizedDir === "") {
      const fsPath =
        this.cwd === "/"
          ? this.bucketPrefix
          : this.normalizePath(this.cwd.replace(/^\/+/, ""));
      return {
        clientPath: this.cwd,
        fsPath:
          this.bucketPrefix && fsPath && fsPath !== this.bucketPrefix
            ? `${this.bucketPrefix}/${fsPath}`
            : this.bucketPrefix || fsPath,
      };
    }

    let clientPath: string;
    if (dir.startsWith("/")) {
      clientPath = "/" + normalizedDir;
    } else {
      const joinedPath = `${this.cwd}/${normalizedDir}`;
      clientPath = "/" + this.normalizePath(joinedPath);
    }

    const segments = clientPath.split("/").filter(Boolean);
    const safeSegments: string[] = [];

    for (const segment of segments) {
      if (segment === "..") {
        if (safeSegments.length > 0) {
          safeSegments.pop();
        }
      } else if (segment !== ".") {
        safeSegments.push(segment);
      }
    }

    clientPath = "/" + safeSegments.join("/");

    let fsPath = this.normalizePath(clientPath.replace(/^\/+/, ""));
    if (this.bucketPrefix) {
      fsPath = this.bucketPrefix + (fsPath ? "/" + fsPath : "");
    }

    return { clientPath, fsPath };
  }

  async chdir(path = "."): Promise<string> {
    try {
      const { clientPath, fsPath } = this._resolvePath(path);

      // For root directory, always allow
      if (clientPath === "/") {
        this.cwd = "/";
        return this.cwd;
      }

      // If fsPath is empty or equals bucketPrefix, we're at the virtual root
      if (!fsPath || fsPath === this.bucketPrefix) {
        this.cwd = "/";
        return this.cwd;
      }

      const invalidChars = /[<>:"|?*\x00-\x1f]/;
      if (invalidChars.test(fsPath)) {
        throw new Error(`Invalid directory name: contains invalid characters`);
      }

      const { data, error } = await this.connection.server.supabase.storage
        .from(this.bucketName)
        .list(fsPath || undefined, {
          limit: 1,
        });

      if (error) {
        throw new Error(
          `Directory does not exist or is not accessible: ${error.message}`
        );
      }

      this.cwd = clientPath;
      return this.cwd;
    } catch (error) {
      console.error("Error changing directory:", error);
      throw new Error(
        `Cannot change directory to ${path}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async list(path = "."): Promise<FileStats[]> {
    try {
      const { fsPath } = this._resolvePath(path);

      const { data, error } = await this.connection.server.supabase.storage
        .from(this.bucketName)
        .list(fsPath || undefined, {
          limit: 1000,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
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
      console.error("Error listing directory:", error);
      return [];
    }
  }

  async get(fileName: string): Promise<FileStats> {
    try {
      const { fsPath } = this._resolvePath(fileName);

      const { data: fileData, error: fileError } =
        await this.connection.server.supabase.storage
          .from(this.bucketName)
          .list(fsPath.split("/").slice(0, -1).join("/") || undefined, {
            limit: 1000,
            search: fsPath.split("/").pop(),
          });

      if (fileError) {
        throw new Error(`Failed to get file info: ${fileError.message}`);
      }

      const file = fileData?.find(
        (item) => item.name === fsPath.split("/").pop()
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
          name: fileName.split("/").pop() || fileName,
          size: 0,
          mtime: new Date(),
          mode: 0o755,
          isDirectory: () => true,
          isFile: () => false,
        };
      }

      throw new Error(`File or directory not found: ${fileName}`);
    } catch (error) {
      console.error("Error getting file info:", error);
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
          "error",
          new Error(`Failed to get signed URL: ${signedUrlError.message}`)
        );
        return;
      }

      if (!signedUrlData?.signedUrl) {
        stream.emit("error", new Error("No signed URL received"));
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
          "error",
          new Error(
            `Failed to download file: ${response.status} ${response.statusText}`
          )
        );
        return;
      }

      if (!response.body) {
        stream.emit("error", new Error("Response body is null"));
        return;
      }

      const nodeStream = Readable.fromWeb(response.body);

      nodeStream.pipe(stream);

      nodeStream.on("error", (error) => {
        console.error("Stream error:", error);
        stream.emit("error", error);
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      stream.emit("error", error);
    }
  }

  read(fileName: string, options?: { start?: number }): StreamResult {
    const { clientPath, fsPath } = this._resolvePath(fileName);

    const stream = new PassThrough({
      read() {},
    });

    this._downloadFile(fsPath, stream, options?.start).catch((error) => {
      stream.emit("error", error);
    });

    return {
      stream,
      clientPath,
    };
  }

  async write(
    fileName: string,
    options?: { append?: boolean; start?: number }
  ): Promise<StreamResult> {
    const { clientPath, fsPath } = this._resolvePath(fileName);

    const pass = new Stream.PassThrough();

    const upload = new tus.Upload(pass, {
      endpoint: `${process.env.SUPABASE_URL}/storage/v1/upload/resumable`,
      uploadDataDuringCreation: true,
      uploadLengthDeferred: true,
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      metadata: {
        bucketName: this.bucketName,
        objectName: fsPath,
        contentType: "application/octet-stream",
      },
      headers: {
        authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        "x-upsert": options?.append ? "true" : "false",
      },
      onError: (error) => {
        console.error("Upload error:", error);
        pass.emit("error", error);
      },
      onSuccess: () => {
        console.log(`File ${fileName} uploaded successfully`);
        pass.end();
      },
    });

    upload.start();

    return {
      stream: pass,
      clientPath,
    };
  }

  delete(path: string): void {
    throw new Error("Method not implemented.");
  }
  mkdir(path: string): string {
    throw new Error("Method not implemented.");
  }
  rename(from: string, to: string): void {
    throw new Error("Method not implemented.");
  }
  chmod(path: string, mode: number): void {
    throw new Error("Method not implemented.");
  }
  getUniqueName(): string {
    throw new Error("Method not implemented.");
  }
}
