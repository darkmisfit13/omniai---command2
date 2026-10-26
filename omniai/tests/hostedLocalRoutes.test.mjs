import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFreePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) =>
    error ? reject(error) : resolve(),
  ));
  return port;
}

async function requestUntilReady(url, options, expectedMessage, child, getLogs) {
  const deadline = Date.now() + 90000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited unexpectedly.\n${getLogs()}`);
    }

    try {
      const response = await fetch(url, options);
      const body = await response.json();

      if (response.status === 404 && body.error === expectedMessage) {
        return { status: response.status, body };
      }
    } catch {
      // The development server may still be starting.
    }

    await wait(500);
  }

  throw new Error(`Route did not return its expected response.\n${getLogs()}`);
}

test("hosted mode blocks local AI and diagnostics routes", { timeout: 120000 }, async () => {
  const port = await getFreePort();
  const nextBin = path.resolve("node_modules/next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)],
    {
      env: {
        ...process.env,
        VERCEL: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;

    const localAI = await requestUntilReady(
      `${baseUrl}/api/local-ai`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", prompt: "security test" }),
      },
      "Local Ollama is available only from the laptop app.",
      child,
      () => logs,
    );

    assert.equal(localAI.status, 404);
    assert.equal(
      localAI.body.error,
      "Local Ollama is available only from the laptop app.",
    );

    const diagnostics = await requestUntilReady(
      `${baseUrl}/api/local-diagnostics`,
      { method: "GET" },
      "Local diagnostics are unavailable in hosted deployments.",
      child,
      () => logs,
    );

    assert.equal(diagnostics.status, 404);
    assert.equal(
      diagnostics.body.error,
      "Local diagnostics are unavailable in hosted deployments.",
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        wait(5000),
      ]);
    }
  }
});
