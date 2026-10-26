import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type LocalAiAction = "route" | "chat";

type LocalAiResult = {
  response?: string;
  model?: string;
  route?: "local" | "escalate";
  reason?: string;
  error?: string;
};

export async function requestLocalAi(
  action: LocalAiAction,
  prompt: string,
  timeoutMs = 15000
): Promise<LocalAiResult> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.user) {
    throw new Error("Sign in to connect to your laptop model.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase connection is not configured.");
  }

  const session = data.session;

  // Separate connection: do not reuse the laptop agent's subscribed channel.
  const relayClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  await relayClient.realtime.setAuth(session.access_token);

  const requestId = crypto.randomUUID();
  const channel = relayClient.channel(`local-ai:${session.user.id}`, {
    config: {
      private: true,
      broadcast: { self: false },
      presence: { key: `request-${requestId}` },
    },
  });

  return new Promise<LocalAiResult>((resolve, reject) => {
    let settled = false;
    let subscribed = false;
    let sent = false;
    let presenceTimer: ReturnType<typeof setTimeout> | undefined;

    const requestTimer = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            "The laptop relay timed out. Check the laptop app and Ollama."
          )
        )
      );
    }, timeoutMs);

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;

      clearTimeout(requestTimer);
      if (presenceTimer) clearTimeout(presenceTimer);

      void relayClient
        .removeAllChannels()
        .catch(() => undefined)
        .finally(() => relayClient.realtime.disconnect());

      callback();
    }

    function sendWhenReady() {
      if (settled || sent || !subscribed) return;

      const laptopReady = Object.values(channel.presenceState()).some(
        (entries) =>
          entries.some(
            (entry) =>
              (entry as unknown as { status?: string }).status === "ready"
          )
      );

      if (!laptopReady) return;

      sent = true;
      if (presenceTimer) clearTimeout(presenceTimer);

      void channel
        .send(
          {
            type: "broadcast",
            event: "request",
            payload: { requestId, action, prompt },
          },
          { timeout: 10000 }
        )
        .then((sendStatus) => {
          if (sendStatus !== "ok") {
            finish(() =>
              reject(
                new Error("Could not send a request to the laptop model.")
              )
            );
          }
        })
        .catch(() => {
          finish(() =>
            reject(
              new Error("Could not send a request to the laptop model.")
            )
          );
        });
    }

    channel.on("broadcast", { event: "response" }, (message) => {
      const payload = message?.payload as
        | (LocalAiResult & { requestId?: string })
        | undefined;

      if (payload?.requestId !== requestId) return;

      if (payload.error) {
        finish(() => reject(new Error(payload.error)));
      } else {
        finish(() => resolve(payload));
      }
    });

    channel.on("presence", { event: "sync" }, sendWhenReady);

    try {
      channel.subscribe((status, subscriptionError) => {
        if (settled) return;

        if (status === "SUBSCRIBED") {
          subscribed = true;

          if (!presenceTimer && !sent) {
            presenceTimer = setTimeout(() => {
              finish(() =>
                reject(
                  new Error(
                    'No ready laptop agent was found. Keep the local app open with "Laptop Link Ready".'
                  )
                )
              );
            }, 10000);
          }

          sendWhenReady();
        } else if (
          ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)
        ) {
          finish(() =>
            reject(
              new Error(
                subscriptionError?.message ||
                  "The private laptop channel could not connect."
              )
            )
          );
        }
      });
    } catch (subscribeError) {
      finish(() =>
        reject(
          subscribeError instanceof Error
            ? subscribeError
            : new Error("Could not start the private laptop channel.")
        )
      );
    }
  });
}