import { NextResponse } from "next/server";
import { AuthError, requireSession, type Session } from "./auth";
import { projects, oid, ensureSetup } from "./db";
import type { ProjectDoc } from "./types";
import { ObjectId } from "mongodb";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler with auth + error handling. */
export function withAuth<T extends unknown[]>(
  fn: (session: Session, ...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      await ensureSetup();
      const session = await requireSession();
      return await fn(session, ...args);
    } catch (e) {
      return handleError(e);
    }
  };
}

export function handleError(e: unknown): Response {
  if (e instanceof AuthError) return bad(e.message, e.status);
  console.error("[api]", e);
  const msg = e instanceof Error ? e.message : "Something went wrong";
  return bad(msg, 500);
}

/** Loads a project owned by the session user (admins can open any). */
export async function loadProject(session: Session, id: string): Promise<ProjectDoc> {
  const _id = oid(id);
  if (!_id) throw new AuthError("Not found", 404);
  const col = await projects();
  const filter: Record<string, unknown> = { _id };
  if (session.role !== "admin") filter.userId = new ObjectId(session.uid);
  const p = await col.findOne(filter);
  if (!p) throw new AuthError("Not found", 404);
  return p;
}

export async function saveProject(id: ObjectId, set: Partial<ProjectDoc>, extra?: Record<string, unknown>) {
  const col = await projects();
  await col.updateOne({ _id: id }, { $set: { ...set, updatedAt: new Date() }, ...(extra ?? {}) });
}

/** Server-Sent-Events helper for long running stage work. */
export function sse(run: (send: (event: string, data: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const ping = setInterval(() => send("ping", Date.now()), 15000);
      run(send)
        .catch((e) => send("error", { message: e instanceof Error ? e.message : String(e) }))
        .finally(() => {
          clearInterval(ping);
          send("done", {});
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
