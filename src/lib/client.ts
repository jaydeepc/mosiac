"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectJSON } from "./types";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { ...init, headers, body, credentials: "same-origin" });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/** Subscribe to a Server-Sent-Events POST endpoint. Returns an abort function. */
export function sseStream(url: string, body: unknown, on: (event: string, data: unknown) => void): () => void {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const t = await res.text();
        let msg = t;
        try {
          msg = JSON.parse(t).error ?? t;
        } catch {
          /* raw */
        }
        on("error", { message: msg || `Request failed (${res.status})` });
        on("done", {});
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /^event: (.*)$/m.exec(chunk)?.[1] ?? "message";
          const dataLine = /^data: (.*)$/m.exec(chunk)?.[1];
          let data: unknown = null;
          try {
            data = dataLine ? JSON.parse(dataLine) : null;
          } catch {
            data = dataLine;
          }
          on(ev, data);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") on("error", { message: (e as Error).message });
      on("done", {});
    }
  })();
  return () => ctrl.abort();
}

export function useProject(id: string, initial?: ProjectJSON) {
  const [project, setProject] = useState<ProjectJSON | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${id}`);
      if (alive.current) setProject(project);
      return project;
    } catch (e) {
      if (alive.current) setError((e as Error).message);
      return null;
    }
  }, [id]);

  const patch = useCallback(
    async (changes: Partial<ProjectJSON>) => {
      setSaving(true);
      setProject((p) => (p ? { ...p, ...changes } : p));
      try {
        const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${id}`, { method: "PATCH", json: changes });
        if (alive.current) setProject(project);
        return project;
      } catch (e) {
        if (alive.current) setError((e as Error).message);
        return null;
      } finally {
        if (alive.current) setSaving(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);

  return { project, setProject, refresh, patch, error, saving };
}

export function useIsMobile(breakpoint = 900) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return mobile;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
