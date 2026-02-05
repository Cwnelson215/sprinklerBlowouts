import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInHours: 24,
    archiveCompletedAfterSeconds: 86400,
    deleteAfterDays: 7,
  });

  boss.on("error", (error) => {
    console.error("pg-boss error:", error);
  });

  return boss;
}

// Job names
export const JOBS = {
  GEOCODE_ADDRESS: "geocode-address",
  ASSIGN_ROUTE_GROUP: "assign-route-group",
  OPTIMIZE_ROUTES: "optimize-routes",
  SEND_EMAIL: "send-email",
  SEND_REMINDERS: "send-reminders",
} as const;
