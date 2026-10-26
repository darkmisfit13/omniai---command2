import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { createServer } from "node:http";
import test from "node:test";

async function getFreePort() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  return port;
}

async function waitForExpectedResponse(url, options, expectedMessage, child, getLogs) {
  const deadline = Date.now() + 90000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited unexpectedly.\n${getLogs()}`);
    }

    try {
      const response = await fetch(url, options);
      const body = await response.json();

      if (body.error === expectedMessage) {
        return { status: response.status, body };
      }
    } catch {
      // Next.js may still be starting or compiling the route.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Expected response was not received.\n${getLogs()}`);
}

test("denies a signed-in non-owner on local AI and diagnostics routes", { timeout: 120000 }, async () => {
  const authRequests = [];
  const authServer = createServer((request, response) => {
    authRequests.push(request.url);

    if (request.url === "/auth/v1/user") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        id: "user-456",
        aud: "authenticated",
        role: "authenticated",
        email: "non-owner@example.com",
        app_metadata: {},
        user_metadata: {},
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      }));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Unexpected mock request" }));
  });

  authServer.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    authServer.once("listening", resolve);
    authServer.once("error", reject);
  });

  const authPort = authServer.address().port;
  const appPort = await getFreePort();
  const nextBin = "node_modules/next/dist/bin/next";
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "-H", "127.0.0.1", "-p", String(appPort)],
    {
      env: {
        ...process.env,
        VERCEL: "",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key-for-local-test",
        OMNIAI_OWNER_ID: "owner-123",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    const baseUrl = `http://127.0.0.1:${appPort}`;
    const tokenHeaders = {
      Authorization: "Bearer fake-non-owner-token",
    };

    const localAI = await waitForExpectedResponse(
      `${baseUrl}/api/local-ai`,
      {
        method: "POST",
        headers: {
          ...tokenHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "chat", prompt: "security test" }),
      },
      "You are not authorized to use the local model.",
      child,
      () => logs,
    );

    assert.equal(localAI.status, 403);

    const diagnostics = await waitForExpectedResponse(
      `${baseUrl}/api/local-diagnostics`,
      {
        method: "GET",
        headers: {
          ...tokenHeaders,
          Host: "localhost",
        },
      },
      "Local diagnostics require a signed-in OmniAI session on this laptop.",
      child,
      () => logs,
    );

    assert.equal(diagnostics.status, 401);
    assert.ok(
  authRequests.length >= 2,
  `Both routes should consult the local auth mock. Requests: ${JSON.stringify(authRequests)}\nNext.js logs:\n${logs}`,
);
    assert.ok(
      authRequests.every((url) => url === "/auth/v1/user"),
      `Unexpected mock request: ${authRequests.join(", ")}`,
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }

    await new Promise((resolve) => authServer.close(() => resolve()));
  }
});

