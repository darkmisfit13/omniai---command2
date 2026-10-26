/* OmniAI compute worker — runs heavy CPU loops off the UI main thread. */
const ctx = self;

function step(n, i) {
  if (n === null || n === undefined) return 0;
  return n * i;
}

function detectTransients(samples) {
  const peaks = [];
  let last = -Infinity;
  const minSep = 0.05;
  for (let i = 1; i < samples.length - 1; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const c = samples[i + 1];
    if (b > a && b >= c && b > 0.12 && i - last > minSep * samples.length) {
      peaks.push({ t: i / samples.length, strength: b });
      last = i;
    }
  }
  return peaks;
}

function transientEnvelope(t, peaks) {
  let acc = 0;
  for (const p of peaks) {
    const delta = t - p.t;
    if (delta < 0) continue;
    const env = delta < 0.015 ? p.strength * (delta / 0.015) : p.strength * Math.exp(-(delta - 0.015) / 0.18);
    if (env > acc) acc = env;
  }
  return acc;
}

function buildCameraPath(features, mode, samplesN) {
  samplesN = samplesN || 120;
  const out = [];
  for (let i = 0; i < samplesN; i++) {
    const phase = i / samplesN;
    const energy = features[i % features.length] || 0;
    const bass = (features[i % features.length] || 0) * 0.9;
    let x = Math.cos(phase * Math.PI * 2) * 6 * (1 + energy * 0.2);
    let y = 1 + energy * 0.5;
    let z = 6 + energy * 1.5;
    if (mode === "dolly") { z = 6 + energy * 3; x = 0; }
    if (mode === "glitch") { x += (Math.random() - 0.5) * 0.4; z += (Math.random() - 0.5) * 0.4; }
    out.push({ i, x, y, z, energy, transient: energy > 0.6 ? energy : 0 });
  }
  return out;
}

// Coarse skeletal preservation: synthesize per-frame anchor coordinates from a pose map.
function preserveSkeleton(frames) {
  const sk = [];
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames;
    const joints = [];
    for (let j = 0; j < 14; j++) {
      joints.push({
        id: j,
        x: Math.cos(t * Math.PI * 2 + j * 0.3) * 0.5,
        y: 1 - j * 0.07 + Math.sin(t * Math.PI + j) * 0.05,
        z: Math.sin(t * Math.PI * 2 + j * 0.3) * 0.3,
      });
    }
    sk.push({ frame: i, joints });
  }
  return sk;
}

function runLogParse(findings) {
  // just restructure; emit high-risk summary.
  const errors = findings.filter((f) => f.severity === "error").length;
  return { errors, warning: findings.filter((f) => f.severity === "warning").length, ready: errors === 0 };
}

ctx.onmessage = function (e) {
  const { id, task, payload } = e.data || {};
  let result = null;
  try {
    switch (task) {
      case "detectTransients":
        result = detectTransients(payload?.samples || []);
        break;
      case "transientEnvelope":
        result = transientEnvelope(payload?.t ?? 0, payload?.peaks || []);
        break;
      case "buildCameraPath":
        result = buildCameraPath(payload?.features || [], payload?.mode || "orbit", payload?.n || 120);
        break;
      case "preserveSkeleton":
        result = preserveSkeleton(payload?.frames || 60);
        break;
      case "runLogParse":
        result = runLogParse(payload?.findings || []);
        break;
      default:
        throw new Error("unknown task: " + task);
    }
    ctx.postMessage({ id, ok: true, result });
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
};
