import type { ClientToServerMessage, ServerToClientMessage } from './onlineProtocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export class OnlineClient {
  private ws: WebSocket | null = null;
  private outQueue: ClientToServerMessage[] = [];
  private onMessage: (msg: ServerToClientMessage) => void;
  private onStatus: (status: ConnectionStatus) => void;
  private closedManually = false;

  constructor(
    onMessage: (msg: ServerToClientMessage) => void,
    onStatus: (status: ConnectionStatus) => void
  ) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  public connect(): void {
    this.closedManually = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    this.onStatus('connecting');

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.closedManually) {
        ws.close();
        return;
      }
      this.onStatus('connected');
      while (this.outQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = this.outQueue.shift();
        if (msg) ws.send(JSON.stringify(msg));
      }
    };

    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as ServerToClientMessage;
        this.onMessage(parsed);
      } catch {
        // Ignore malformed server payload
      }
    };

    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      this.onStatus('disconnected');
    };

    ws.onerror = () => {
      // onclose will follow
    };
  }

  public send(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (!this.closedManually) {
      this.outQueue.push(msg);
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  public disconnect(): void {
    this.closedManually = true;
    this.outQueue = [];
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatus('disconnected');
  }
}
