import { WebSocket } from "ws";
import type { WSEvents, WSContext } from "hono/ws";

const MAX_BUFFER = 262_144;
const connections = new Set<SignalRelay>();

/** Binary LiveKit signaling only; media stays on the configured RTC ports. */
export class SignalRelay {
  private upstream: WebSocket;
  private downstream?: WSContext;
  private queue: Uint8Array<ArrayBuffer>[] = [];
  private queuedBytes = 0;
  private closed = false;
  private attachTimer?: ReturnType<typeof setTimeout>;

  constructor(
    public readonly room: string,
    public readonly identity: string,
    url: URL,
  ) {
    this.upstream = new WebSocket(url, { maxPayload: MAX_BUFFER, handshakeTimeout: 4_000 });
    this.upstream.on("error", () => this.close());
    this.upstream.on("close", () => this.close());
    this.upstream.on("message", (data, binary) => {
      if (!binary) return this.close();
      const bytes = new Uint8Array(Array.isArray(data) ? Buffer.concat(data) : data);
      if (this.downstream) {
        if (this.downstream.readyState !== 1) return this.close();
        const socket = this.downstream.raw;
        if (socket instanceof WebSocket && socket.bufferedAmount > MAX_BUFFER) return this.close();
        this.downstream.send(bytes);
        return;
      }
      this.queuedBytes += bytes.byteLength;
      if (this.queuedBytes > MAX_BUFFER || this.queue.length >= 32) return this.close();
      this.queue.push(bytes);
    });
    connections.add(this);
  }

  async ready() {
    await new Promise<void>((resolve, reject) => {
      this.upstream.once("open", resolve);
      this.upstream.once("error", () => reject(new Error("Signaling upstream unavailable")));
      this.upstream.once("close", () => reject(new Error("Signaling upstream closed")));
    });
    this.attachTimer = setTimeout(() => this.close(), 5_000);
    this.attachTimer.unref();
  }

  events(): WSEvents {
    return {
      onOpen: (_event, socket) => {
        clearTimeout(this.attachTimer);
        if (this.closed) return socket.close(1008, "Admission ended");
        this.downstream = socket;
        for (const bytes of this.queue) socket.send(bytes);
        this.queue = [];
        this.queuedBytes = 0;
      },
      onMessage: (event) => {
        if (this.closed || this.upstream.readyState !== WebSocket.OPEN) return this.close();
        if (this.upstream.bufferedAmount > MAX_BUFFER || event.data instanceof Blob)
          return this.close();
        this.upstream.send(event.data);
      },
      onClose: () => this.close(),
      onError: () => this.close(),
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.attachTimer);
    connections.delete(this);
    this.queue = [];
    this.downstream?.close(1008, "Admission ended");
    this.upstream.terminate();
  }
}

export function closeSignalConnections(room?: string, identity?: string) {
  for (const relay of connections) {
    if (room !== undefined && relay.room !== room) continue;
    if (identity !== undefined && relay.identity !== identity) continue;
    relay.close();
  }
}
