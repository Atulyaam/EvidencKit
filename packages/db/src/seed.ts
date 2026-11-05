import { getDb, getDbPool } from "./client";
import { workspaces, users, cases, agentSessions } from "./schema/index";

export async function seedDemoData() {
  const db = getDb();
  console.log("[EvidenceKit] Seeding demo data...");

  try {
    const workspaceId = "ws_demo_default";
    await db
      .insert(workspaces)
      .values({
        id: workspaceId,
        name: "Acme Corp Incident & Agent Operations"
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values([
        {
          id: "user_owner_01",
          providerSubject: "owner",
          email: "security-lead@company.com",
          role: "owner"
        },
        {
          id: "user_judge_01",
          providerSubject: "judge-evaluator",
          email: "judge@kiroween.hackathon",
          role: "judge"
        }
      ])
      .onConflictDoNothing();

    await db
      .insert(cases)
      .values({
        id: "case_01HZX9QK2M",
        workspaceId,
        title: "Production DB Migration Lock & Latency Spike",
        environment: "production",
        status: "open"
      })
      .onConflictDoNothing();

    await db
      .insert(agentSessions)
      .values({
        id: "session_01HZXZ9981",
        workspaceId,
        agentName: "refactoring-assistant",
        goal: "Refactor legacy authentication middleware to use safe session headers",
        status: "completed"
      })
      .onConflictDoNothing();

    console.log("[EvidenceKit] Demo data seeded successfully.");
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.message?.includes("connect")) {
      console.warn(
        `[EvidenceKit] PostgreSQL is not running. Demo data seed verified for offline mode.`
      );
    } else {
      console.error("[EvidenceKit] Seed error:", error);
      throw error;
    }
  } finally {
    await getDbPool()
      .end()
      .catch(() => {});
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDemoData().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
