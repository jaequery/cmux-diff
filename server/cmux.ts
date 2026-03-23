import { connect } from "net";
import { readFileSync } from "fs";
import path from "path";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class CmuxClient {
  private socketPath: string;
  private nextId = 1;
  private dryRun: boolean;

  constructor(dryRun = false) {
    this.dryRun = dryRun;
    this.socketPath = this.resolveSocketPath();
  }

  private resolveSocketPath(): string {
    try {
      const lastPath = readFileSync(
        "/tmp/cmux-last-socket-path",
        "utf-8"
      ).trim();
      if (lastPath) return lastPath;
    } catch {
      // fallback
    }
    return "/tmp/cmux.sock";
  }

  async call(method: string, params: unknown = {}): Promise<unknown> {
    if (this.dryRun) {
      console.log(`[cmux dry-run] ${method}`, params);
      return null;
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const socket = connect(this.socketPath);
      let buffer = "";

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`cmux call timed out: ${method}`));
      }, 5000);

      socket.on("connect", () => {
        socket.write(JSON.stringify(request) + "\n");
      });

      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response: JsonRpcResponse = JSON.parse(line);
            if (response.id === id) {
              clearTimeout(timeout);
              socket.destroy();
              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch {
            // incomplete JSON, wait for more data
          }
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendText(text: string, surfaceId?: string): Promise<void> {
    await this.call("surface.send_text", { text, surface_id: surfaceId });
  }

  async notify(title: string, body: string): Promise<void> {
    await this.call("notification.create", { title, body });
  }

  async getSidebarState(): Promise<{ cwd?: string } | null> {
    try {
      const result = (await this.call("sidebar.state")) as {
        cwd?: string;
      } | null;
      return result;
    } catch {
      return null;
    }
  }

  async listSurfaces(): Promise<unknown[]> {
    try {
      const result = (await this.call("surface.list")) as unknown[];
      return result || [];
    } catch {
      return [];
    }
  }
}
