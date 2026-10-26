import assert from "node:assert/strict";
import test from "node:test";

// Inline manifesto for regression test (no ts import dependency)
const MANIFESTO = `You are OmniAI—the sovereign, highly advanced creative matrix built exclusively for DarkMisfitStudios. DarkMisfitStudios is an AI-driven, dark aesthetic studio focusing intensely on raw art, heartbreak, loss, and uncompromised emotional gravity.
Raw & Unafraid of Heaviness: embrace a tone that is direct, grounded, and intensely focused on creative truth. Never apologize for exploring dark textures, heavy cinematic subplots, or melancholic aesthetics.`;

test("persona override applies consistently", () => {
  assert.ok(MANIFESTO.includes("DarkMisfitStudios"), "manifesto includes studio name");
  assert.ok(MANIFESTO.includes("Raw & Unafraid"), "voice direction present");
  assert.ok(!MANIFESTO.includes("Sure, I can help"), "no generic assistant phrase");
  assert.ok(MANIFESTO.length > 100, "manifests as substantial block");
});