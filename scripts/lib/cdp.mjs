/**
 * A minimal Chrome DevTools Protocol client.
 *
 * Node 26 ships `fetch` and `WebSocket`, so this needs no dependency -- and a
 * dependency would be a poor trade here, since we use four methods of a
 * protocol that is stable at 1.3.
 *
 * web-ext drives the same browser over `--remote-debugging-pipe`, which is a
 * separate channel: the two coexist, and this one is ours.
 */

export const CDP_PORT = 9222;

/** Thrown when the browser is not reachable, so the CLI can explain the fix. */
export class ProbeConnectionError extends Error {}

export async function connect() {
  let version;
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    version = await response.json();
  } catch (cause) {
    throw new ProbeConnectionError(`No browser on port ${CDP_PORT}`, { cause });
  }

  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiting = pending.get(message.id);
    if (!waiting) {
      // An event rather than a response. We subscribe to none, so ignore it.
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      waiting.reject(new Error(`${message.method ?? 'CDP'}: ${message.error.message}`));
    } else {
      waiting.resolve(message.result);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener(
      'error',
      () => {
        reject(new ProbeConnectionError(`Could not open a CDP socket on port ${CDP_PORT}`));
      },
      { once: true },
    );
  });

  socket.addEventListener('close', () => {
    for (const waiting of pending.values()) {
      waiting.reject(new ProbeConnectionError('The browser closed the CDP connection'));
    }
    pending.clear();
  });

  return {
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() {
      socket.close();
    },
  };
}

/** Opens a tab and attaches to it, returning the ids later calls need. */
export async function openTab(connection, url) {
  const { targetId } = await connection.send('Target.createTarget', { url });
  const { sessionId } = await connection.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  await connection.send('Page.enable', {}, sessionId);
  await connection.send('Runtime.enable', {}, sessionId);

  return { targetId, sessionId };
}

export async function closeTab(connection, targetId) {
  await connection.send('Target.closeTarget', { targetId });
}
