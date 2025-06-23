import { Readable, Writable } from "node:stream";
import { Connection } from "../connection.js";
import { Promisable } from "@repo/utils/types/promisable";

export interface FileStats {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
  mtime: Date;
  mode: number;
}

export interface StreamResult {
  stream: Readable | Writable;
  clientPath: string;
}

abstract class FileSystem {
  connection: Connection;
  cwd: string;
  protected _root: string;

  constructor(
    connection: Connection,
    { root, cwd }: { root?: string; cwd?: string } = {}
  ) {
    this.connection = connection;
    this._root = this.resolveRootPath(root);
    this.cwd = this.normalizePath(cwd || "/");
  }

  get root() {
    return this._root;
  }
  currentDirectory() {
    return this.cwd;
  }
  protected abstract normalizePath(path: string): string;
  protected abstract resolveRootPath(root?: string): string;
  protected abstract _resolvePath(dir?: string): {
    clientPath: string;
    fsPath: string;
  };
  abstract chdir(path?: string | null): Promisable<string>;
  abstract list(path?: string): Promisable<FileStats[]>;
  abstract get(fileName: string): Promisable<FileStats>;
  abstract write(
    fileName: string,
    options?: { append?: boolean; start?: number }
  ): StreamResult;
  abstract read(fileName: string, options?: { start?: number }): StreamResult;
  abstract delete(path: string): Promisable<void>;
  abstract mkdir(path: string): Promisable<string>;
  abstract rename(from: string, to: string): Promisable<void>;
  abstract chmod(path: string, mode: number): Promisable<void>;
  abstract getUniqueName(): Promisable<string>;
}

export default FileSystem;
