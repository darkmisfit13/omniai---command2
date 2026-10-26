"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SKILLS, SKILLS_BY_ID, SKILL_GROUPS, type SkillGroup } from "@/lib/skills";

type Thread = {
  id: string;
  title: string;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  activeId: string | null;
  activeSkills: string[];
  onToggleSkill: (id: string) => void;
  /** Clear every active skill in one click. */
  onClearSkills: () => void;
};

export default function ChatSidebar({
  open,
  onClose,
  activeId,
  activeSkills,
  onToggleSkill,
  onClearSkills,
}: Props) {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(() => new Set());
  const mutationsRef = useRef<Set<string>>(new Set());
  const [tab, setTab] = useState<"threads" | "skills">("threads");
  const [openGroups, setOpenGroups] = useState<SkillGroup[]>(["Craft", "Studio"]);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("conversations")
      .select("id,title,created_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (loadError) {
      setError(loadError.message);
      return;
    }
    setError(null);
    setThreads((data ?? []) as Thread[]);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("synaptex-conversations-changed", refresh);
    window.addEventListener("popstate", refresh);
    return () => {
      window.removeEventListener("synaptex-conversations-changed", refresh);
      window.removeEventListener("popstate", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // The "click again to confirm" window auto-cancels, so it never relies on a
  // blur event (which a re-render can swallow) to reset.
  useEffect(() => {
    if (!confirmId) return;
    const timer = window.setTimeout(() => setConfirmId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmId]);

  // Escape closes the overlay when it is presented as one.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && renamingId === null) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, renamingId]);

  async function createThread() {
    if (creating) return;
    setCreating(true);
    try {
      const { data, error: insertError } = await supabase
        .from("conversations")
        .insert({ title: "New chat" })
        .select("id,title,created_at")
        .single();

      if (insertError) throw new Error(insertError.message);
      if (!data?.id) throw new Error("The new conversation has no ID.");

      await load();
      window.dispatchEvent(new Event("synaptex-conversations-changed"));
      router.push(`/?conversation=${encodeURIComponent(data.id)}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a chat.");
    } finally {
      setCreating(false);
    }
  }

  /** Bearer headers for the thread-management route (session-scoped). */
  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function setThreadMutation(id: string, active: boolean) {
    if (active) mutationsRef.current.add(id);
    else mutationsRef.current.delete(id);

    setMutatingIds((current) => {
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function cancelRename(thread: Thread) {
    setRenamingId(null);
    setDraftTitle(thread.title);
    setError(null);
  }

  async function commitRename(id: string, originalTitle: string) {
    if (mutationsRef.current.has(id)) return;

    const next = draftTitle.trim().slice(0, 200);
    if (!next) {
      setError("A thread needs a title.");
      renameInputRef.current?.focus();
      return;
    }

    if (next === originalTitle) {
      setRenamingId(null);
      setError(null);
      return;
    }

    setThreadMutation(id, true);
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ title: next }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: string; title?: string; error?: string }
        | null;

      if (!res.ok || payload?.ok !== true || payload.id !== id || payload.title !== next) {
        throw new Error(payload?.error || "The server did not confirm this rename.");
      }

      setThreads((current) =>
        current.map((thread) => (thread.id === id ? { ...thread, title: payload.title! } : thread))
      );
      setRenamingId((current) => (current === id ? null : current));
      setDraftTitle(next);
      window.dispatchEvent(new Event("synaptex-conversations-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename this thread.");
      renameInputRef.current?.focus();
    } finally {
      setThreadMutation(id, false);
    }
  }

  /**
   * Threads cannot be hard-deleted — messages.conversation_id is
   * ON DELETE RESTRICT — so deleting archives the thread out of every list.
   */
  async function archiveThread(id: string) {
    if (mutationsRef.current.has(id)) return;

    setConfirmId(null);
    setError(null);
    setThreadMutation(id, true);

    let archived = false;
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: string; error?: string }
        | null;

      if (!res.ok || payload?.ok !== true || payload.id !== id) {
        throw new Error(payload?.error || "The server did not confirm this deletion.");
      }

      archived = true;
      setThreads((current) => current.filter((thread) => thread.id !== id));
      window.dispatchEvent(new Event("synaptex-conversations-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this thread.");
    } finally {
      setThreadMutation(id, false);
    }

    if (archived && id === activeId) {
      const next = threads.find((thread) => thread.id !== id);
      if (next) {
        router.push(`/?conversation=${encodeURIComponent(next.id)}`);
      } else {
        await createThread();
      }
    }
  }

  function toggleGroup(group: SkillGroup) {
    setOpenGroups((list) =>
      list.includes(group) ? list.filter((g) => g !== group) : [...list, group]
    );
  }

  const grouped = SKILL_GROUPS.map((group) => ({
    group,
    items: SKILLS.filter((skill) => skill.group === group),
  }));

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close chat sidebar"
          onClick={onClose}
          className="chat-side-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        aria-label="Chat sidebar"
        className={`chat-side ${open ? "chat-side--open" : ""}`}
      >
        <div className="chat-side__head">
          <button type="button" className="d3-btn d3-btn--primary chat-side__new" onClick={createThread} disabled={creating}>
            <span aria-hidden="true">+</span>
            {creating ? "Starting…" : "New chat"}
          </button>
          <button type="button" className="d3-btn chat-side__close" onClick={onClose} aria-label="Close chat sidebar">
            ‹
          </button>
        </div>

        <div className="chat-side__tabs" role="tablist" aria-label="Chat sidebar sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "threads"}
            className={`chat-side__tab ${tab === "threads" ? "is-active" : ""}`}
            onClick={() => setTab("threads")}
          >
            Threads
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "skills"}
            className={`chat-side__tab ${tab === "skills" ? "is-active" : ""}`}
            onClick={() => setTab("skills")}
          >
            Skills
            {activeSkills.length > 0 && <span className="chat-side__count">{activeSkills.length}</span>}
          </button>
        </div>

        {error && (
          <p className="chat-side__error" role="alert">
            {error}
          </p>
        )}

        {tab === "threads" ? (
          <div className="chat-side__scroll">
            {threads.length === 0 && !error && (
              <p className="chat-side__empty">No threads yet. Start one above.</p>
            )}
            <ul className="chat-side__list">
              {threads.map((thread) => {
                const active = thread.id === activeId;
                return (
                  <li key={thread.id} className={`d3-tile thread ${active ? "thread--active" : ""}`}>
                    {renamingId === thread.id ? (
                      <form
                        className="thread__rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void commitRename(thread.id, thread.title);
                        }}
                      >
                        <input
                          ref={renameInputRef}
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              event.stopPropagation();
                              cancelRename(thread);
                            }
                          }}
                          maxLength={200}
                          aria-label={`Rename ${thread.title}`}
                          disabled={mutatingIds.has(thread.id)}
                        />
                        <span className="thread__rename-actions">
                          <button
                            type="submit"
                            className="thread__action"
                            aria-label={`Save new name for ${thread.title}`}
                            title="Save name"
                            disabled={mutatingIds.has(thread.id)}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="thread__action thread__action--danger"
                            aria-label={`Cancel renaming ${thread.title}`}
                            title="Cancel"
                            onClick={() => cancelRename(thread)}
                            disabled={mutatingIds.has(thread.id)}
                          >
                            ×
                          </button>
                        </span>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="thread__open"
                          onClick={() => {
                            router.push(`/?conversation=${encodeURIComponent(thread.id)}`);
                            onClose();
                          }}
                          title={thread.title}
                        >
                          <span className="thread__dot" aria-hidden="true" />
                          <span className="thread__title">{thread.title}</span>
                        </button>

                        <span className="thread__actions">
                          <button
                            type="button"
                            className="thread__action"
                            aria-label={`Rename ${thread.title}`}
                            title="Rename"
                            onClick={() => {
                              setRenamingId(thread.id);
                              setDraftTitle(thread.title);
                              setConfirmId(null);
                              setError(null);
                            }}
                            disabled={mutatingIds.has(thread.id)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="thread__action thread__action--danger"
                            aria-label={`Delete ${thread.title}`}
                            title={confirmId === thread.id ? "Click again to confirm" : "Delete"}
                            onClick={() => {
                              if (confirmId === thread.id) void archiveThread(thread.id);
                              else {
                                setConfirmId(thread.id);
                                setRenamingId(null);
                                setError(null);
                              }
                            }}
                            disabled={mutatingIds.has(thread.id)}
                          >
                            {mutatingIds.has(thread.id) ? "…" : confirmId === thread.id ? "sure?" : "✕"}
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="chat-side__scroll">
            <div className="chat-side__skillshead">
              <span className="hud-kicker">Active skills</span>
              {activeSkills.length > 0 && (
                <button type="button" className="chat-side__clear" onClick={onClearSkills}>
                  Clear
                </button>
              )}
            </div>
            {activeSkills.length === 0 ? (
              <p className="chat-side__empty">
                Nothing active. Pick any skill and it shapes every reply until you turn it off.
              </p>
            ) : (
              <ul className="chat-side__active">
                {activeSkills.map((id) => {
                  const skill = SKILLS_BY_ID.get(id);
                  if (!skill) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="chat-chip chat-chip--on"
                        onClick={() => onToggleSkill(id)}
                        title={`Turn off ${skill.name}`}
                      >
                        {skill.name} <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {grouped.map(({ group, items }) => {
              const expanded = openGroups.includes(group);
              const activeInGroup = items.filter((s) => activeSkills.includes(s.id)).length;
              return (
                <div key={group} className="skill-group">
                  <button
                    type="button"
                    className="skill-group__head"
                    aria-expanded={expanded}
                    onClick={() => toggleGroup(group)}
                  >
                    <span className="hud-kicker">{group}</span>
                    <span className="skill-group__meta">
                      {activeInGroup > 0 && <b>{activeInGroup} on</b>}
                      <i aria-hidden="true">{expanded ? "−" : "+"}</i>
                    </span>
                  </button>

                  {expanded && (
                    <ul className="skill-group__list">
                      {items.map((skill) => {
                        const on = activeSkills.includes(skill.id);
                        return (
                          <li key={skill.id}>
                            <button
                              type="button"
                              className={`skill ${on ? "skill--on" : ""}`}
                              aria-pressed={on}
                              onClick={() => onToggleSkill(skill.id)}
                              title={skill.instruction}
                            >
                              <span className="skill__name">{skill.name}</span>
                              <span className="skill__blurb">{skill.blurb}</span>
                              <span className="skill__state" aria-hidden="true">
                                {on ? "ON" : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
