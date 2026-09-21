import type { BusEvent } from "./types";

type Listener = (event: BusEvent) => void;

const g = globalThis as {
  __oniocheckListeners?: Set<Listener>;
  __checkflowListeners?: Set<Listener>;
};

export const listeners: Set<Listener> =
  (g.__oniocheckListeners ??= g.__checkflowListeners ??= new Set());

export function publish(event: BusEvent) {
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {
      // a broken listener must not break the mutation path
    }
  }
}
