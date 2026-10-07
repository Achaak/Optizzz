import { answer, type EngineRequest } from "./requests";

self.onmessage = (event: MessageEvent<{ id: number; request: EngineRequest }>) => {
  self.postMessage({ id: event.data.id, answer: answer(event.data.request) });
};
