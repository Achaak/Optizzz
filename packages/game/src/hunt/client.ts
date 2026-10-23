// Runs engine requests off the page's main thread; falls back to running them inline if the page refuses workers.
// Each app says how its worker starts: a module worker on the site (./module-worker.ts); inlined in the extension's
// content script, where a worker file would be looked for on the game's origin.
import { answer, type EngineAnswer, type EngineRequest } from "./requests";

export interface Engine {
  <R extends EngineRequest>(request: R): Promise<EngineAnswer<R>>;
  /** Stops the worker: requests still waiting never answer. */
  dispose: () => void;
}

interface Pending {
  request: EngineRequest;
  resolve: (value: unknown) => void;
}

/** Lets the page paint « Calcul… » before the inline computation blocks it. */
const inline = (request: EngineRequest) =>
  new Promise<unknown>((resolve) => setTimeout(() => resolve(answer(request)), 0));

/** `spawn` starts a worker running ./engine.worker.ts; when it throws, the requests run inline. */
export function createEngine(spawn: () => Worker): Engine {
  let worker: Worker | null = null;
  const pending = new Map<number, Pending>();
  let nextId = 0;
  try {
    worker = spawn();
    worker.addEventListener("message", (event: MessageEvent<{ id: number; answer: unknown }>) => {
      pending.get(event.data.id)?.resolve(event.data.answer);
      pending.delete(event.data.id);
    });
    // A page policy can refuse the worker only once it starts: finish its requests inline.
    worker.addEventListener("error", () => {
      worker?.terminate();
      worker = null;
      for (const { request, resolve } of pending.values()) void inline(request).then(resolve);
      pending.clear();
    });
  } catch {
    worker = null;
  }

  const engine = <R extends EngineRequest>(request: R) =>
    new Promise<EngineAnswer<R>>((resolve) => {
      const done = (value: unknown) => resolve(value as EngineAnswer<R>);
      if (!worker) {
        void inline(request).then(done);
        return;
      }
      const id = nextId++;
      pending.set(id, { request, resolve: done });
      worker.postMessage({ id, request });
    });
  return Object.assign(engine, {
    dispose: () => {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  });
}
