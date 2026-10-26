"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProviderConsole from "./ProviderConsole";
import WorkspaceControls from "./WorkspaceControls";

type UserRow = {
  id: string;
  email: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  isAdmin: boolean;
  isBanned?: boolean;
  lastSignInAt: string | null;
};

type AdminTab = "providers" | "users";

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("providers");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [configured, setConfigured] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token ?? null;
    setToken(tk);
    if (!tk) { setIsOwner(false); setLoading(false); return; }
    const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${tk}` }, cache: "no-store" }).catch(() => null);
    if (!res) { setError("Could not reach admin service."); setLoading(false); return; }
    if (res.status === 403) { setIsOwner(false); setLoading(false); return; }
    const json = await res.json().catch(() => null);
    setIsOwner(true);
    setConfigured(Boolean(json?.configured));
    setUsers(Array.isArray(json?.users) ? json.users : []);
    setNote(typeof json?.note === "string" ? json.note : "");
    if (json?.error) setError(json.error);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function revoke(id: string, hard: boolean) {
    if (!token) { alert("Sign in first."); return; }
    const who = users.find(u => u.id === id);
    const name = who?.email ?? id;
    if (hard) { if (!window.confirm(`Permanently DELETE account "${name}"? This cannot be undone.`)) return; }
    else if (!window.confirm(`Ban / revoke access for "${name}" (blocks their login, keeps data)?`)) return;
    setBusyId(id); setError(null);
    try {
      const mode = hard ? "delete" : "ban";
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}&mode=${mode}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error ?? "Failed to revoke access."); return; }
      // Update local list: removed/banned
      setUsers(prev => hard ? prev.filter(u => u.id !== id) : prev.map(u => u.id === id ? { ...u, isBanned: true } : u));
      alert(hard ? `Account ${name} deleted.` : `Access revoked for ${name}.`);
    } finally { setBusyId(null); }
  }

  if (loading) return <div className="p-6 text-sm text-ash">Loading admin console…</div>;
  if (isOwner === false) {
    return (
      <div className="max-w-xl space-y-4 p-6">
        <h1 className="pilot-voice text-2xl">Admin</h1>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-300">
          Admin access is restricted. Only the workspace owner has admin rights and only the signed-in account can revoke other users.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="pilot-voice text-2xl">Admin</h1>
          <p className="text-sm text-ash mt-1">Owner-only. Manage the AI providers your platform runs on, review who has accessed the program, revoke access, or remove accounts.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="d3-btn h-8 px-3 text-xs">Refresh</button>
      </div>

      <div className="flex gap-2">
        {([
          { key: "providers", label: "AI Providers", hint: "connect or disconnect keys" },
          { key: "users", label: "Users", hint: `${users.length} registered` },
        ] as { key: AdminTab; label: string; hint: string }[]).map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`d3-btn h-9 px-4 text-xs ${tab === entry.key ? "d3-btn--primary" : ""}`}
            title={entry.hint}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "providers" ? (
        <div className="space-y-6">
          <ProviderConsole />
          <WorkspaceControls />
        </div>
      ) : (
        <>
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {!configured && note && (
        <div className="rounded-lg border border-[#8b7fff]/40 bg-[#8b7fff]/10 px-4 py-3 text-sm text-[#c5bfff]">{note}</div>
      )}

      <div className="rounded-xl border border-[#211d34] bg-[#14121f] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#211d34] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#e8e6f2]">Registered users</span>
          <span className="text-xs text-ash">{users.length} total</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ash">
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Verified</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Last sign-in</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const banned = Boolean((u as any).isBanned);
                return (
                  <tr key={u.id} className={`border-t border-[#211d34] ${banned ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2 text-[#e8e6f2]">{u.email ?? u.id}</td>
                    <td className="px-4 py-2">
                      {u.emailConfirmedAt ? <span className="text-[#6ee7b7]">Verified</span> : <span className="text-ash">Pending</span>}
                      {banned && <span className="ml-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">BANNED</span>}
                    </td>
                    <td className="px-4 py-2 text-ash">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2 text-ash">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2">{u.isAdmin ? <span className="text-[#a69eff] font-semibold">Admin (owner)</span> : <span className="text-ash">User</span>}</td>
                    <td className="px-4 py-2 text-right">
                      {!u.isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => revoke(u.id, false)}
                            disabled={busyId === u.id}
                            className={`d3-btn h-7 px-2 text-[10px] mr-1 ${banned ? "text-[#6ee7b7]/70" : "text-rose-300"}`}
                            title={banned ? "Already banned" : "Ban/revoke access (keep data, block login)"}
                          >{busyId === u.id ? "…" : (banned ? "Banned" : "Revoke")}</button>
                          <button
                            type="button"
                            onClick={() => revoke(u.id, true)}
                            disabled={busyId === u.id}
                            className="d3-btn h-7 px-2 text-[10px] text-rose-300"
                            title="Permanently delete this account"
                          >{busyId === u.id ? "…" : "Delete"}</button>
                        </>
                      )}
                      {u.isAdmin && <span className="text-[#a69eff] text-xs">you (admin)</span>}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-ash">
                  {configured ? "No users returned." : "Configure SUPABASE_SERVICE_ROLE_KEY (admin env) to list + remove users."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#211d34] text-[10px] leading-5 text-ash/70">
          Revoke = bans the user for ~100 years (blocks login, keeps data). Delete = removes the account entirely (irreversible). You cannot act on your own (admin) account here. Both actions run through the owner-verified <span className="font-mono">/api/admin/users</span> admin client which bypasses RLS — identity is verified with OMNIAI_OWNER_ID FIRST, before any mutation.
        </div>
      </div>
        </>
      )}
    </div>
  );
}
