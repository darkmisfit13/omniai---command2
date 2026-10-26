"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ApprovalItem } from "@/lib/types";

type RejectionResult = {
  approval_id: string;
  status: "rejected";
  resolved_at: string;
  audit_id: string;
};

function isRejectionResult(value: unknown): value is RejectionResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;

  return (
    typeof result.approval_id === "string" &&
    result.status === "rejected" &&
    typeof result.resolved_at === "string" &&
    typeof result.audit_id === "string"
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const processing = useRef(false);
  const mounted = useRef(false);

  async function fetchPending(): Promise<ApprovalItem[]> {
    const { data, error: loadError } = await supabase
      .from("approval_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (loadError) throw new Error(loadError.message);

    return (data ?? []) as ApprovalItem[];
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;

    void (async () => {
      try {
        const pending = await fetchPending();

        if (active) setItems(pending);
      } catch (loadError) {
        if (active) {
          setError(errorMessage(loadError, "Could not load approvals."));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  async function refresh() {
    if (processing.current) return;

    processing.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const pending = await fetchPending();

      if (mounted.current) setItems(pending);
    } catch (refreshError) {
      if (mounted.current) {
        setError(
          errorMessage(refreshError, "Could not refresh approvals.")
        );
      }
    } finally {
      processing.current = false;

      if (mounted.current) setLoading(false);
    }
  }

  async function reject(id: string) {
    if (processing.current || loading) return;

    const item = items.find((entry) => entry.id === id);

    if (!item) {
      setError("This approval item is no longer displayed. Refresh the list.");
      return;
    }

    processing.current = true;
    setBusyId(id);
    setError(null);
    setNotice(null);

    try {
      const { data, error: rejectionError } = await supabase.rpc(
        "reject_approval",
        { p_approval_id: id }
      );

      if (rejectionError) {
        throw new Error(rejectionError.message);
      }

      if (!isRejectionResult(data) || data.approval_id !== id) {
        throw new Error(
          "The server returned an unexpected rejection result."
        );
      }

      if (mounted.current) {
        setItems((previous) =>
          previous.filter((entry) => entry.id !== id)
        );

        setNotice(
          "The item was rejected and its audit entry was recorded."
        );
      }
    } catch (rejectionError) {
      const detail = errorMessage(
        rejectionError,
        "Could not confirm rejection."
      );

      let refreshed: ApprovalItem[] | null = null;

      try {
        refreshed = await fetchPending();
      } catch {
        // Preserve the rejection error if refreshing also fails.
      }

      if (mounted.current) {
        if (refreshed !== null) setItems(refreshed);

        setError(
          `Rejection was not confirmed: ${detail} ${
            refreshed !== null
              ? "The pending list has been refreshed. An item disappearing from this list does not by itself confirm how it was resolved."
              : "The pending list could not be refreshed. Refresh before trying again."
          }`
        );
      }
    } finally {
      processing.current = false;

      if (mounted.current) setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="pilot-voice text-2xl">Approvals</h2>

      <p role="status" className="text-sm text-ash">
        Website execution is temporarily disabled pending authorization and
        approval security repairs. Pending items can be reviewed or rejected.
        Approval and execution controls are unavailable on this page.
      </p>

      <button
        type="button"
        disabled={loading || busyId !== null}
        onClick={() => void refresh()}
        className="border border-ash/40 px-3 py-1 rounded text-sm hover:border-signal disabled:opacity-50"
      >
        {loading ? "Loading..." : "Refresh pending items"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="text-sm text-signal">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-ash">Loading approvals...</p>
      ) : items.length === 0 ? (
        <p className="text-ash">
          {error
            ? "No pending items are displayed."
            : "Nothing waiting on you right now."}
        </p>
      ) : null}

      {items.map((item) => (
        <div
          key={item.id}
          className="border border-ash/40 rounded p-4"
        >
          <p className="text-sm text-signal mb-1">{item.action}</p>

          <pre className="text-xs text-ink/70 whitespace-pre-wrap break-words mb-3">
            {JSON.stringify(item.payload, null, 2)}
          </pre>

          {item.action === "website.edit" && (
            <p className="text-xs text-ash mb-3">
              This website edit cannot be executed while maintenance is active.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="bg-wine px-3 py-1 rounded text-sm opacity-50 cursor-not-allowed"
            >
              Approval unavailable
            </button>

            <button
              type="button"
              disabled={loading || busyId !== null}
              onClick={() => void reject(item.id)}
              className="border border-ash/40 px-3 py-1 rounded text-sm hover:border-signal disabled:opacity-50"
            >
              {busyId === item.id ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}