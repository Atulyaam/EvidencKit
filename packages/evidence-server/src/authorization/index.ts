import crypto from "node:crypto";
import { getServerEnv } from "../env";

export type UserRole = "owner" | "reviewer" | "judge";

export interface ServerSession {
  sessionId: string;
  tokenHash: string;
  userId: string;
  role: UserRole;
  authorizedWorkspaces: string[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  csrfToken: string;
}

export interface SessionContext {
  sessionId?: string;
  userId?: string;
  role: UserRole;
  isOwner: boolean;
  isJudgeMode: boolean;
  authorizedWorkspaces?: string[];
  csrfToken?: string;
}

export interface CreateSessionParams {
  userId: string;
  role: UserRole;
  authorizedWorkspaces: string[];
  ttlSeconds?: number;
}

export class SessionStore {
  private sessionsById: Map<string, ServerSession> = new Map();
  private sessionIdsByTokenHash: Map<string, string> = new Map();

  public static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
  }

  public async createSession(
    params: CreateSessionParams
  ): Promise<{ session: ServerSession; token: string }> {
    const rawToken = `ek_sess_${crypto.randomBytes(32).toString("base64url")}`;
    const tokenHash = SessionStore.hashToken(rawToken);
    const sessionId = `sess_${crypto.randomUUID().replace(/-/g, "")}`;
    const csrfToken = crypto.randomBytes(16).toString("hex");

    const ttl = params.ttlSeconds ?? 86400; // default 24h
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const session: ServerSession = {
      sessionId,
      tokenHash,
      userId: params.userId,
      role: params.role,
      authorizedWorkspaces: [...params.authorizedWorkspaces],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      csrfToken
    };

    this.sessionsById.set(sessionId, session);
    this.sessionIdsByTokenHash.set(tokenHash, sessionId);

    return { session, token: rawToken };
  }

  public async validateSession(token: string): Promise<ServerSession | null> {
    if (!token || typeof token !== "string") {
      return null;
    }

    const tokenHash = SessionStore.hashToken(token);
    const sessionId = this.sessionIdsByTokenHash.get(tokenHash);
    if (!sessionId) {
      return null;
    }

    const session = this.sessionsById.get(sessionId);
    if (!session) {
      this.sessionIdsByTokenHash.delete(tokenHash);
      return null;
    }

    // Check revocation
    if (session.revokedAt !== null) {
      return null;
    }

    // Check expiration
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return session;
  }

  public async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessionsById.get(sessionId);
    if (!session) {
      return false;
    }
    session.revokedAt = new Date().toISOString();
    return true;
  }

  public async revokeAllUserSessions(userId: string): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const session of this.sessionsById.values()) {
      if (session.userId === userId && session.revokedAt === null) {
        session.revokedAt = now;
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    this.sessionsById.clear();
    this.sessionIdsByTokenHash.clear();
  }
}

let globalSessionStore = new SessionStore();

export function getSessionStore(): SessionStore {
  return globalSessionStore;
}

export function resetSessionStore(): void {
  globalSessionStore.clear();
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts header value safely regardless of whether headers is a standard Headers object or a plain Record.
 */
function extractHeader(
  headers: Headers | Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(key) || undefined;
  }
  const val = (headers as Record<string, string | string[] | undefined>)[key.toLowerCase()];
  return Array.isArray(val) ? val[0] : val;
}

/**
 * Validates and extracts authorization context for incoming requests.
 * Never trusts unauthenticated client-provided roles, user IDs, or headers like x-evidencekit-user.
 */
export function evaluateSessionContext(
  headers: Headers | Record<string, string | string[] | undefined>
): SessionContext {
  const env = getServerEnv();

  // 1. Extract bearer token or session cookie
  const authHeader = extractHeader(headers, "authorization");
  let bearerToken: string | undefined;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    bearerToken = authHeader.slice(7).trim();
  }

  const cookieHeader = extractHeader(headers, "cookie");
  const cookieSessionToken = cookieHeader
    ?.match(/(?:^|;\s*)evidencekit_session=([^;]+)/)?.[1]
    ?.trim();

  const token = bearerToken || cookieSessionToken;

  // 2. Validate token against Server-Side Session Store
  if (token) {
    // Test/development-only Bearer token authentication:
    // Strictly impossible when NODE_ENV === "production".
    // Neither CI nor E2E environment variables can ever override this production restriction.
    // In production, users MUST authenticate through legitimate server-side sessions.
    if (env.NODE_ENV !== "production") {
      if (env.AUTH_SECRET && safeCompare(token, env.AUTH_SECRET)) {
        return {
          userId: env.OWNER_GITHUB_ID || "admin",
          role: "owner",
          isOwner: true,
          isJudgeMode: false,
          authorizedWorkspaces: ["*"]
        };
      }
    }

    // Lookup session token in SessionStore
    const tokenHash = SessionStore.hashToken(token);
    // Note: SessionStore lookup is synchronous in-memory
    const session = (globalSessionStore as any).sessionIdsByTokenHash.get(tokenHash)
      ? (globalSessionStore as any).sessionsById.get(
          (globalSessionStore as any).sessionIdsByTokenHash.get(tokenHash)
        )
      : null;

    if (
      session &&
      session.revokedAt === null &&
      new Date(session.expiresAt).getTime() > Date.now()
    ) {
      return {
        sessionId: session.sessionId,
        userId: session.userId,
        role: session.role,
        isOwner: session.role === "owner",
        isJudgeMode: false,
        authorizedWorkspaces: [...session.authorizedWorkspaces],
        csrfToken: session.csrfToken
      };
    }
  }

  // 3. Fallback for unauthenticated requests
  // In demo mode, provide read-only judge role bounded to demo workspaces.
  // In production/non-demo mode, public unauthenticated requests have no workspace permissions.
  return {
    userId: undefined,
    role: "judge",
    isOwner: false,
    isJudgeMode: env.DEMO_MODE,
    authorizedWorkspaces: env.DEMO_MODE ? ["default", "ws_demo_default"] : []
  };
}

/**
 * Validates CSRF token on state-changing requests when authenticated via cookie.
 */
export function validateCsrfProtection(
  headers: Headers | Record<string, string | string[] | undefined>,
  context: SessionContext
): void {
  const cookieHeader = extractHeader(headers, "cookie");
  const hasCookieSession = Boolean(cookieHeader?.match(/(?:^|;\s*)evidencekit_session=([^;]+)/));

  // CSRF verification is only required for cookie-based authentication
  if (!hasCookieSession || !context.csrfToken) {
    return;
  }

  const clientCsrf = extractHeader(headers, "x-csrf-token");
  if (!clientCsrf || !safeCompare(clientCsrf, context.csrfToken)) {
    throw new Error("Forbidden: Invalid or missing CSRF token.");
  }
}

/**
 * Guard that enforces owner-only permissions for mutation operations (POST, PUT, DELETE, PATCH).
 * Throws a typed 403 Forbidden error in public judge mode or for non-owners.
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

/**
 * Guard that strictly enforces workspace ownership and isolation (SEC-004).
 * Throws a typed 403 Forbidden error if the user is not authorized for the requested workspace.
 */
export function requireWorkspaceAuthorization(
  context: SessionContext,
  requestedWorkspaceId: string
): void {
  if (!requestedWorkspaceId) {
    throw new Error("Bad Request: Workspace identifier is required.");
  }

  // If authorizedWorkspaces is not specified (unrestricted owner in test contexts)
  if (context.isOwner && context.authorizedWorkspaces === undefined) {
    return;
  }

  const workspaces = context.authorizedWorkspaces || [];
  if (workspaces.includes("*") || workspaces.includes(requestedWorkspaceId)) {
    return;
  }

  throw new Error(`Forbidden: Not authorized for workspace ${requestedWorkspaceId}`);
}
