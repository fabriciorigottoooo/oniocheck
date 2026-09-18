import { listeners } from "@/lib/bus";
import type { BusEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let listener: ((e: BusEvent) => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (listener) listeners.delete(listener);
    listener = null;
    if (ping) clearInterval(ping);
    ping = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
          );
        } catch {
          cleanup();
        }
      };
      send({ type: "hello", at: new Date().toISOString() });
      listener = (e) => send(e);
      listeners.add(listener);
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 25_000);
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
