import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { JobUpdate } from '../types/domain.js';

type Client = WebSocket & { subscriptions: Set<string>; isAlive: boolean };

let wss: WebSocketServer | null = null;
const subscribersByTopic = new Map<string, Set<Client>>();

/**
 * Topic = `job:<jobId>`. Clients subscribe by sending `{ "type": "subscribe", "topic": "job:<id>" }`.
 * Workers publish JobUpdate messages to a topic; we fan-out to all subscribed sockets.
 */
export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: env.WS_PATH });

  wss.on('connection', (ws: WebSocket) => {
    const client = ws as Client;
    client.subscriptions = new Set();
    client.isAlive = true;

    client.on('pong', () => { client.isAlive = true; });

    client.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && typeof msg.topic === 'string') {
          subscribe(client, msg.topic);
        } else if (msg.type === 'unsubscribe' && typeof msg.topic === 'string') {
          unsubscribe(client, msg.topic);
        } else if (msg.type === 'ping') {
          client.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {
        client.send(JSON.stringify({ type: 'error', error: 'invalid message' }));
      }
    });

    client.on('close', () => {
      client.subscriptions.forEach(t => unsubscribe(client, t));
    });

    client.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
  });

  // Heartbeat — drop sockets that don't respond to pings
  const interval = setInterval(() => {
    wss?.clients.forEach((sock) => {
      const c = sock as Client;
      if (!c.isAlive) return c.terminate();
      c.isAlive = false;
      try { c.ping(); } catch { /* noop */ }
    });
  }, 30_000);

  wss.on('close', () => clearInterval(interval));
  logger.info({ path: env.WS_PATH }, '✓ WebSocket server initialised');
}

function subscribe(client: Client, topic: string): void {
  client.subscriptions.add(topic);
  let set = subscribersByTopic.get(topic);
  if (!set) { set = new Set(); subscribersByTopic.set(topic, set); }
  set.add(client);
  client.send(JSON.stringify({ type: 'subscribed', topic }));
}

function unsubscribe(client: Client, topic: string): void {
  client.subscriptions.delete(topic);
  const set = subscribersByTopic.get(topic);
  if (set) {
    set.delete(client);
    if (set.size === 0) subscribersByTopic.delete(topic);
  }
}

/** Publish a JobUpdate to all sockets subscribed to `job:<jobId>`. */
export function publish(jobId: string, payload: JobUpdate): void {
  const topic = `job:${jobId}`;
  const set = subscribersByTopic.get(topic);
  if (!set || set.size === 0) return;
  const msg = JSON.stringify({ type: 'update', topic, payload });
  set.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}
