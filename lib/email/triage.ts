// Read-only Gmail triage helper.
//
// Given a Gmail OAuth access token, this scans the owner's unread mail and
// surfaces messages that look urgent or opportunity-related so the Email
// Triage page can present them for review.
//
// This module performs network reads only. It never sends, deletes, or
// modifies mail, and it holds no credentials of its own — the caller passes a
// short-lived access token obtained through the owner's own OAuth flow.

export type EmailAlertPriority = "high" | "medium" | "low";

export type EmailAlert = {
  subject: string;
  sender: string;
  priority: EmailAlertPriority;
  reason: string;
  snippet: string;
};

type GmailHeader = { name?: string; value?: string };

type GmailMessageReference = { id?: string };

type GmailListResponse = { messages?: GmailMessageReference[] };

type GmailMessage = {
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
};

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Ordered from most to least urgent. The first match wins.
const HIGH_SIGNALS = [
  "urgent",
  "asap",
  "immediately",
  "action required",
  "deadline",
  "final notice",
  "overdue",
  "time-sensitive",
  "time sensitive",
  "expires",
  "interview",
  "offer letter",
  "contract",
  "escalation",
];

const MEDIUM_SIGNALS = [
  "recruiter",
  "job",
  "application",
  "invoice",
  "payment",
  "follow up",
  "follow-up",
  "meeting",
  "proposal",
  "opportunity",
  "awaiting your reply",
  "response needed",
];

function classify(subject: string, sender: string, snippet: string): {
  priority: EmailAlertPriority;
  reason: string;
} {
  const haystack = `${subject} ${sender} ${snippet}`.toLowerCase();

  const highSignal = HIGH_SIGNALS.find((signal) => haystack.includes(signal));
  if (highSignal) {
    return {
      priority: "high",
      reason: `Matched an urgency signal ("${highSignal}").`,
    };
  }

  const mediumSignal = MEDIUM_SIGNALS.find((signal) => haystack.includes(signal));
  if (mediumSignal) {
    return {
      priority: "medium",
      reason: `Matched an opportunity signal ("${mediumSignal}").`,
    };
  }

  return {
    priority: "low",
    reason: "No urgency or opportunity signals were detected.",
  };
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const target = name.toLowerCase();
  const match = headers?.find((header) => header.name?.toLowerCase() === target);
  return match?.value?.trim() ?? "";
}

/**
 * Scan the owner's unread Gmail for urgent or opportunity-related messages.
 *
 * @param accessToken A valid Gmail OAuth access token with read scope.
 * @param limit Maximum number of alerts to return (defaults to 8, capped at 25).
 */
export async function scanGmailForAlerts(
  accessToken: string,
  limit = 8,
): Promise<EmailAlert[]> {
  const token = accessToken?.trim();
  if (!token) {
    throw new Error("A Gmail OAuth access token is required.");
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 8, 1), 25);

  // Over-fetch a little so we still return `safeLimit` alerts after the
  // low-priority messages are filtered out.
  const listUrl = `${GMAIL_BASE}/messages?q=${encodeURIComponent(
    "is:unread",
  )}&maxResults=${safeLimit * 3}`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (listResponse.status === 401 || listResponse.status === 403) {
    throw new Error(
      "Gmail rejected the access token. Generate a fresh token and try again.",
    );
  }

  if (!listResponse.ok) {
    throw new Error(
      `Gmail list request failed with status ${listResponse.status}.`,
    );
  }

  const list = (await listResponse.json()) as GmailListResponse;
  const ids = (list.messages ?? [])
    .map((message) => message.id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return [];
  }

  const messages = await Promise.all(
    ids.map(async (id) => {
      const url = `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as GmailMessage;
    }),
  );

  const alerts: EmailAlert[] = [];

  for (const message of messages) {
    if (!message) continue;

    const headers = message.payload?.headers;
    const subject = headerValue(headers, "Subject") || "(no subject)";
    const sender = headerValue(headers, "From") || "(unknown sender)";
    const snippet = message.snippet ?? "";

    const { priority, reason } = classify(subject, sender, snippet);
    if (priority === "low") continue;

    alerts.push({ subject, sender, priority, reason, snippet });
  }

  alerts.sort((a, b) =>
    a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1,
  );

  return alerts.slice(0, safeLimit);
}
