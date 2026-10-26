import test from "node:test";
import assert from "node:assert/strict";
import { getOwnerAuthorizationDecision } from "../lib/ownerAuthorization.ts";

test("allows the configured owner", () => {
  assert.equal(
    getOwnerAuthorizationDecision("owner-123", "owner-123"),
    "owner",
  );
});

test("denies a different user", () => {
  assert.equal(
    getOwnerAuthorizationDecision("user-456", "owner-123"),
    "not-owner",
  );
});

test("denies access when owner configuration is missing", () => {
  assert.equal(
    getOwnerAuthorizationDecision("owner-123", undefined),
    "not-configured",
  );
});

test("denies access when owner configuration is blank", () => {
  assert.equal(
    getOwnerAuthorizationDecision("owner-123", "   "),
    "not-configured",
  );
});

test("denies access when no authenticated user ID is supplied", () => {
  assert.equal(
    getOwnerAuthorizationDecision(null, "owner-123"),
    "not-owner",
  );
});
