import { getServerEnv } from "../env";

export type UserRole = "owner" | "reviewer" | "judge";

export interface SessionContext {
  userId?: string;
  role: UserRole;
  isOwner: boolean;
  isJudgeMode: boolean;
}

/**
 * Extracts and evaluates authorization context for incoming requests.
 * In DEMO_MODE, unauthenticated requests are treated as read-only "judge" role.
 * Owner privileges require explicit matching against OWNER_GITHUB_ID.
 */
export function evaluateSessionContext(
  headers: Headers | Record<string, string | string[] | undefined>
): SessionContext {
  const env = getServerEnv();
  const getHeader = (key: string): string | undefined => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(key) || undefined;
    }
    const val = (headers as Record<string, string | string[] | undefined>)[key.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  const authUser = getHeader("x-evidencekit-user") || getHeader("authorization");
  const isOwner = Boolean(
    authUser &&
    (authUser === env.OWNER_GITHUB_ID || authUser.replace(/^Bearer\s+/i, "") === env.AUTH_SECRET)
  );

  if (isOwner) {
    return {
      userId: env.OWNER_GITHUB_ID,
      role: "owner",
      isOwner: true,
      isJudgeMode: false
    };
  }

  // In demo mode or public access, default to read-only judge role
  return {
    userId: undefined,
    role: "judge",
    isOwner: false,
    isJudgeMode: env.DEMO_MODE
  };
}

/**
 * Guard that enforces owner-only permissions for mutation operations (POST, PUT, DELETE, PATCH).
 * Throws a typed 403 Forbidden error in public judge mode.
 */
export function requireOwnerAuthorization(context: SessionContext): void {
  if (!context.isOwner) {
    if (context.isJudgeMode) {
      throw new Error(
        "Forbidden: Public Judge Mode is strictly READ-ONLY. Mutations, uploads, and imports require owner authentication."
      );
    }
    throw new Error("Unauthorized: Owner privileges required.");
  }
}
