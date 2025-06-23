import nodePath from "path";
import { randomBytes } from "crypto";
import {
  accessSync,
  chmodSync,
  createReadStream,
  createWriteStream,
  constants,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { Connection } from "../connection.js";
import { FileSystemError } from "../errors.js";
import FileSystem, { FileStats } from "./fs.js";

class NodeFileSystem extends FileSystem {
  constructor(
    connection: Connection,
    options: { root?: string; cwd?: string } = {}
  ) {
    super(connection, options);
  }

  protected normalizePath(path: string): string {
    return nodePath.normalize(path).replace(/[/\\]+/g, "/");
  }

  protected resolveRootPath(root?: string): string {
    if (!root) root = process.cwd();
    if (nodePath.isAbsolute(root)) {
      return nodePath.normalize(root);
    } else {
      return nodePath.resolve(root);
    }
  }

  protected _resolvePath(dir = ".") {
    // Use node's path module for normalization
    const normalizedPath = nodePath.normalize(dir).replace(/[/\\]+/g, "/");

    // Join cwd with new path
    let clientPath = nodePath.isAbsolute(normalizedPath)
      ? normalizedPath
      : nodePath.join(this.cwd, normalizedPath).replace(/[/\\]+/g, "/");

    // Ensure clientPath starts with a leading slash
    if (!clientPath.startsWith("/")) {
      clientPath = "/" + clientPath;
    }

    // Prevent escaping root: clamp to '/'
    const segments = clientPath.split("/").filter(Boolean);
    let safeSegments = [];
    for (const seg of segments) {
      if (seg === "..") {
        if (safeSegments.length > 0) safeSegments.pop();
      } else if (seg !== ".") {
        safeSegments.push(seg);
      }
    }
    clientPath = "/" + safeSegments.join("/");

    // For fsPath, join root with clientPath, but avoid double-absolute path on Windows
    let fsPath = nodePath.join(this._root, clientPath.slice(1));

    // Convert fsPath to use forward slashes
    fsPath = fsPath.replace(/\\/g, "/");

    return {
      clientPath,
      fsPath,
    };
  }

  chdir(path = ".") {
    const { clientPath, fsPath } = this._resolvePath(path);
    const statObj = statSync(fsPath);
    if (!statObj.isDirectory())
      throw new FileSystemError("Not a valid directory");
    this.cwd = clientPath;
    return this.currentDirectory();
  }

  list(path = ".") {
    const { fsPath } = this._resolvePath(path);
    const fileNames = readdirSync(fsPath);
    const results = fileNames.map((fileName) => {
      const filePath = nodePath.join(fsPath, fileName);
      try {
        accessSync(filePath, constants.F_OK);
        const statObj = statSync(filePath);

        return {
          ...statObj,
          name: fileName,
        };
      } catch {
        return null;
      }
    });
    return Promise.resolve(results.filter(Boolean) as FileStats[]);
  }

  get(fileName: string) {
    const { fsPath } = this._resolvePath(fileName);
    const statObj = statSync(fsPath);

    return Promise.resolve({
      ...statObj,
      name: fileName,
    });
  }

  write(
    fileName: string,
    {
      append = false,
      start = undefined,
    }: { append?: boolean; start?: number } = {}
  ) {
    const { fsPath, clientPath } = this._resolvePath(fileName);
    const stream = createWriteStream(fsPath, {
      flags: !append ? "w+" : "a+",
      start,
    });
    stream.once("error", async () => {
      try {
        unlinkSync(fsPath);
      } catch {
        /* ignore error */
      }
    });
    stream.once("close", () => stream.end());
    return {
      stream,
      clientPath,
    };
  }

  read(fileName: string, { start = undefined }: { start?: number } = {}) {
    const { clientPath, fsPath } = this._resolvePath(fileName);
    if (statSync(fsPath).isDirectory()) {
      throw new FileSystemError("Cannot read a directory");
    }
    const stream = createReadStream(fsPath, { flags: "r", start });
    return {
      stream,
      clientPath,
    };
  }

  delete(path: string) {
    const { fsPath } = this._resolvePath(path);
    const statObj = statSync(fsPath);
    if (statObj.isDirectory()) return Promise.resolve(rmdirSync(fsPath));
    else return Promise.resolve(unlinkSync(fsPath));
  }

  mkdir(path: string) {
    const { fsPath } = this._resolvePath(path);
    mkdirSync(fsPath, { recursive: true });
    return fsPath;
  }

  rename(from: string, to: string) {
    const { fsPath: fromPath } = this._resolvePath(from);
    const { fsPath: toPath } = this._resolvePath(to);
    return Promise.resolve(renameSync(fromPath, toPath));
  }

  chmod(path: string, mode: number) {
    const { fsPath } = this._resolvePath(path);
    return chmodSync(fsPath, mode);
  }

  getUniqueName() {
    const randomPart = randomBytes(8).toString("hex");
    const timestampPart = Date.now().toString(36);
    return `${timestampPart}-${randomPart}`;
  }
}

export default NodeFileSystem;
