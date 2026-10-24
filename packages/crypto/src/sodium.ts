import sodium from "libsodium-wrappers-sumo";

export type Sodium = typeof sodium;

/** libsodium, once its WebAssembly is loaded. Every public function of this package awaits it. */
export async function loadSodium(): Promise<Sodium> {
  await sodium.ready;
  return sodium;
}
