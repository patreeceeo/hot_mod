/**
 * A client-side implementation of the ESM-HMR spec, for real.
 * See https://github.com/FredKSchott/esm-hmr
 */

declare global {
  interface ImportMeta {
    hot?: HotModuleState;
  }
}

type DisposeCallback = () => void;
// TODO better typing
// deno-lint-ignore no-explicit-any
type AcceptCallback = (args: { module: any; deps: any[] }) => void;
type AcceptCallbackObject = {
  deps: string[];
  callback: AcceptCallback;
};

// deno-lint-ignore no-explicit-any
function debug(...args: any[]) {
  console.log(`[ESM-HMR]`, ...args);
}
function reload() {
  location.reload();
}

// deno-lint-ignore no-explicit-any
let SOCKET_MESSAGE_QUEUE: any[] = [];
// deno-lint-ignore no-explicit-any
function _sendSocketMessage(socket: WebSocket, msg: any) {
  socket.send(JSON.stringify(msg));
}
// deno-lint-ignore no-explicit-any
function sendSocketMessage(socket: WebSocket, msg: any) {
  if (socket.readyState !== socket.OPEN) {
    SOCKET_MESSAGE_QUEUE.push(msg);
  } else {
    _sendSocketMessage(socket, msg);
  }
}

const socketURL =
  // deno-lint-ignore no-explicit-any
  (window as any).HMR_WEBSOCKET_URL ||
  // TODO make common function
  (location.protocol === "http:" ? "ws://" : "wss://") + location.host + "/";

const REGISTERED_MODULES: { [key: string]: HotModuleState } = {};

export class HotModuleState {
  id: string;
  #socket: WebSocket;
  // deno-lint-ignore no-explicit-any
  data: any = {};
  isLocked = false;
  isDeclined = false;
  isAccepted = false;
  acceptCallbacks: AcceptCallbackObject[] = [];
  disposeCallbacks: DisposeCallback[] = [];

  constructor(id: string, socket: WebSocket) {
    this.id = id;
    this.#socket = socket;
  }

  lock(): void {
    this.isLocked = true;
  }

  dispose(callback: DisposeCallback): void {
    this.disposeCallbacks.push(callback);
  }

  invalidate(): void {
    reload();
  }

  decline(): void {
    this.isDeclined = true;
  }

  accept(_deps: string[], callback: true | AcceptCallback = true): void {
    if (this.isLocked) {
      return;
    }
    if (!this.isAccepted) {
      sendSocketMessage(this.#socket, { id: this.id, type: "hotAccept" });
      this.isAccepted = true;
    }
    if (!Array.isArray(_deps)) {
      callback = _deps || callback;
      _deps = [];
    }
    if (callback === true) {
      callback = () => {};
    }
    const deps = _deps.map((dep) => {
      return new URL(dep, `${window.location.origin}${this.id}`).pathname;
    });
    this.acceptCallbacks.push({
      deps,
      callback,
    });
  }
}

function createHotContext(fullUrl: string, socket: WebSocket) {
  const id = new URL(fullUrl).pathname;
  const existing = REGISTERED_MODULES[id];
  if (existing) {
    existing.lock();
    return existing;
  }
  const state = new HotModuleState(id, socket);
  REGISTERED_MODULES[id] = state;
  return state;
}

function installHotContext(importMeta: ImportMeta, socket: WebSocket) {
  // TODO conditionally inject this in build
  // this condition is a temporary workaround until I figure out how to inject config/env vars,
  // or accomplish the above TODO
  if (location.hostname === "localhost") {
    importMeta.hot = createHotContext(importMeta.url, socket);
  }
}

function reImport(moduleId: string, updateId: number) {
  return import(`${location.href}${moduleId}?mtime=${updateId}`);
}

async function applyUpdate(id: string) {
  const state = REGISTERED_MODULES[id];
  if (!state) {
    return false;
  }
  if (state.isDeclined) {
    return false;
  }

  const acceptCallbacks = state.acceptCallbacks;
  const disposeCallbacks = state.disposeCallbacks;
  state.disposeCallbacks = [];
  state.data = {};

  disposeCallbacks.map((callback) => callback());
  const updateID = Date.now();
  for (const { deps, callback: acceptCallback } of acceptCallbacks) {
    const [module, ...depModules] = await Promise.all([
      reImport(id, updateID),
      ...deps.map((depId) => reImport(depId, updateID)),
    ]);
    acceptCallback({ module, deps: depModules });
  }

  return true;
}

let isHmrClientRunning = false;
function startHmrClient(socket: WebSocket) {
  socket.addEventListener("open", () => {
    SOCKET_MESSAGE_QUEUE.forEach((msg) => _sendSocketMessage(socket, msg));
    SOCKET_MESSAGE_QUEUE = [];
  });
  socket.addEventListener("message", async ({ data: _data }) => {
    if (!_data) {
      return;
    }
    const data = JSON.parse(_data);
    debug("message", data);
    if (data.type === "reload") {
      debug("message: reload");
      reload();
      return;
    }
    if (data.type !== "update") {
      debug("message: unknown", data);
      return;
    }
    debug("message: update", data);
    debug(data.url, Object.keys(REGISTERED_MODULES));
    try {
      const ok = await applyUpdate(data.url);
      if (!ok) {
        reload();
      }
    } catch (err) {
      console.error(err);
      reload();
    }
  });

  isHmrClientRunning = true;
  debug("listening for file changes...");
}

export function useClient(importMeta: ImportMeta) {
  if (!isHmrClientRunning) {
    // Seems like Deno cannot handle subprotocols
    // const socket = new WebSocket(socketURL, "esm-hmr");
    const socket = new WebSocket(socketURL);
    startHmrClient(socket);
    installHotContext(importMeta, socket);
  }
}
