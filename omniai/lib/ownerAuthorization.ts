export type OwnerAuthorizationDecision =
  | "owner"
  | "not-configured"
  | "not-owner";

export function getOwnerAuthorizationDecision(
  userId: string | null | undefined,
  ownerId: string | null | undefined,
): OwnerAuthorizationDecision {
  const configuredOwnerId = ownerId?.trim();

  if (!configuredOwnerId) {
    return "not-configured";
  }

  if (!userId || userId !== configuredOwnerId) {
    return "not-owner";
  }

  return "owner";
}
