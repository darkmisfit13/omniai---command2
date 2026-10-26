export type HudActivityMode = "idle" | "llm" | "sync" | "check";

export type HudActivityEvent = {
  source: string;
  intensity: number;
  mode: HudActivityMode;
};

export const HUD_ACTIVITY_EVENT = "omniai-hud-activity";

export function emitHudActivity(payload: HudActivityEvent) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<HudActivityEvent>(HUD_ACTIVITY_EVENT, { detail: payload }),
  );
}

export function subscribeHudActivity(
  listener: (event: HudActivityEvent) => void,
) {
  if (typeof window === "undefined") return () => {};

  function onEvent(event: Event) {
    const custom = event as CustomEvent<HudActivityEvent>;
    if (!custom.detail) return;
    listener(custom.detail);
  }

  window.addEventListener(HUD_ACTIVITY_EVENT, onEvent);
  return () => window.removeEventListener(HUD_ACTIVITY_EVENT, onEvent);
}
