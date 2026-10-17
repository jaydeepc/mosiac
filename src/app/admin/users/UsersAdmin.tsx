"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { LANGUAGES, languageLabel } from "@/lib/config";
import { Plus, Spinner, Trash, Pencil, Check } from "@/components/Icons";

interface U {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  active: boolean;
  language: string;
  createdAt: string;
  lastLoginAt: string | null;
}

function randomPassword() {
  const words = ["tile", "paper", "sage", "teal", "apricot", "brush", "story", "mosaic", "ink", "wash"];
  const w = () => words[Math.floor(Math.random() * words.length)];
  return `${w()}-${w()}-${Math.floor(100 + Math.random() * 900)}`;
}

export function UsersAdmin({ selfId }: { selfId: string }) {
  const [list, setList] = useState<U[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: randomPassword(), role: "member" as "member" | "admin", language: "en" });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetFor, setResetFor] = useState<{ id: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { users } = await api<{ users: U[] }>("/api/admin/users");
      setList(users);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/users", { method: "POST", json: form });
      setCreated({ email: form.email, password: form.password });
      setForm({ email: "", name: "", password: randomPassword(), role: "member", language: "en" });
      setCreating(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, changes: Partial<U> & { password?: string }) {
    setError(null);
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", json: changes });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(u: U) {
    if (!confirm(`Delete ${u.email} and all of their Mosaics? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      {created && (
        <div className="card p-4 flex flex-wrap items-center gap-3" style={{ borderColor: "#2F6F73", background: "#EEF3F1" }}>
          <Check size={16} stroke="#2F6F73" />
          <span className="text-sm">
            Account created for <strong>{created.email}</strong>. Share this password once:
          </span>
          <code className="text-sm font-bold px-2.5 py-1 rounded-lg bg-white border border-line">{created.password}</code>
          <button type="button" className="btn-ghost text-teal" onClick={() => navigator.clipboard?.writeText(`${created.email} / ${created.password}`)}>
            Copy
          </button>
          <button type="button" className="btn-ghost ml-auto" onClick={() => setCreated(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted">{list ? `${list.length} ${list.length === 1 ? "person" : "people"}` : "Loading…"}</span>
        <button type="button" className="btn-primary" style={{ padding: "12px 20px" }} onClick={() => setCreating((v) => !v)}>
          <Plus size={16} /> Add a person
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card p-5 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Email
            <input className="input" style={{ height: 46 }} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="person@example.com" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Name
            <input className="input" style={{ height: 46 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asha Raman" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Password
            <div className="flex gap-2">
              <input className="input" style={{ height: 46 }} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="btn-secondary" style={{ padding: "0 14px", height: 46, fontSize: 13 }} onClick={() => setForm({ ...form, password: randomPassword() })}>
                New
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Role
            <select className="input" style={{ height: 46 }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "member" | "admin" })}>
              <option value="member">Member — builds their own Mosaics</option>
              <option value="admin">Admin — can also manage people</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Language
            <select className="input" style={{ height: 46 }} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={busy} className="btn-primary" style={{ height: 46, padding: "0 20px" }}>
              {busy ? <Spinner light /> : <Plus size={16} />} Create account
            </button>
            <button type="button" className="btn-secondary" style={{ height: 46 }} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-muted" style={{ background: "#F7F5EF" }}>
                <th className="px-4 py-3 font-bold">Person</th>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold">Language</th>
                <th className="px-4 py-3 font-bold">Access</th>
                <th className="px-4 py-3 font-bold">Last sign-in</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list?.map((u) => (
                <tr key={u.id} className="border-t border-line-3">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full inline-flex items-center justify-center font-bold text-teal" style={{ background: "linear-gradient(135deg, #DCE3F5, #9CC3C5)" }}>
                        {(u.name || u.email)[0]?.toUpperCase()}
                      </span>
                      <div className="flex flex-col">
                        <strong>{u.name}</strong>
                        <span className="text-muted text-[13px]">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={u.role} disabled={u.id === selfId} onChange={(e) => patch(u.id, { role: e.target.value as "admin" | "member" })} className="pill" style={{ padding: "6px 10px" }}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">{languageLabel(u.language)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={u.id === selfId}
                      onClick={() => patch(u.id, { active: !u.active })}
                      className="pill"
                      style={{ padding: "6px 10px", background: u.active ? "#EEF3F1" : "#F0EDE6", color: u.active ? "#2F6F73" : "#5B6472", borderColor: u.active ? "#9CC3C5" : "#E6E2DA" }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: u.active ? "#2F6F73" : "#9CA3AF" }} />
                      {u.active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {resetFor?.id === u.id ? (
                        <>
                          <input className="input" style={{ height: 36, width: 170, fontSize: 13 }} value={resetFor.password} onChange={(e) => setResetFor({ id: u.id, password: e.target.value })} />
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: "8px 12px", fontSize: 13 }}
                            onClick={async () => {
                              await patch(u.id, { password: resetFor.password });
                              setCreated({ email: u.email, password: resetFor.password });
                              setResetFor(null);
                            }}
                          >
                            Save
                          </button>
                          <button type="button" className="btn-ghost" onClick={() => setResetFor(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn-secondary" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setResetFor({ id: u.id, password: randomPassword() })}>
                            <Pencil size={14} /> Reset password
                          </button>
                          <button type="button" aria-label={`Delete ${u.email}`} disabled={u.id === selfId} className="btn-secondary" style={{ padding: "8px 10px", color: "#9A4A26" }} onClick={() => remove(u)}>
                            <Trash size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {list && list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No one yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
