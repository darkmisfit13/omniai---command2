import {
  authorizeUser,
  isUserSession,
  json,
} from "@/lib/generation/serverAuth";
import {
  SHIELD_ACTION,
  evaluateShield,
  shieldExcerpt,
} from "@/lib/security/omniShield";
import { logSecurityEvent } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Repository Protection Protocol — routing middleware.
 *
 * Every request that is about to reach the model may pass through here first.
 * The caller's session metadata is cross-referenced against the hardcoded
 * owner signature (OMNIAI_OWNER_ID) before any system-modification instruction
 * is allowed toward the pipeline. Blocked attempts are refused with a neutral
 * message and written to the owner's audit log.
 */
export async function POST(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Send a JSON object with a `text` field." }, 400);
  }

  const raw = body as Record<string, unknown>;
  const text = typeof raw.text === "string" ? raw.text : "";
  const conversationId =
    typeof raw.conversationId === "string" ? raw.conversationId : null;

  const decision = evaluateShield({
    text,
    userId: session.userId,
    ownerId: process.env.OMNIAI_OWNER_ID,
  });

  let logged = false;
  if (!decision.allowed) {
    const audit = await logSecurityEvent({
      token: session.token,
      action: SHIELD_ACTION,
      outcome: "blocked",
      detail: {
        event: "shield.blocked",
        actor_id: session.userId,
        role: decision.role,
        categories: decision.categories,
        reasons: decision.reasons,
        conversation_id: conversationId,
        excerpt: shieldExcerpt(text),
        length: text.length,
        at: new Date().toISOString(),
      },
    });
    logged = audit.logged;
  }

  return json({
    allowed: decision.allowed,
    mode: decision.mode,
    role: decision.role,
    owner: decision.owner,
    safeFrame: decision.safeFrame,
    categories: decision.categories,
    message: decision.message,
    logged,
  });
}
