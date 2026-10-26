/**
 * Stable, labelled dial ranges.
 *
 * Ported from the OmniAI build: a dial whose scale changes every time a
 * counter ticks over is unreadable, so the maximum snaps to 1 / 2.5 / 5 / 10
 * times the order of magnitude of the current value.
 */
export function gaugeScale(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(10, value)));
  return (
    [1, 2.5, 5, 10]
      .map((n) => n * magnitude)
      .find((n) => n >= value) ?? magnitude * 10
  );
}
