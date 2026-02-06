import { prisma } from "./prisma";
import { JobStatus } from "@prisma/client";

// Job names
export const JOBS = {
  GEOCODE_ADDRESS: "geocode-address",
  ASSIGN_ROUTE_GROUP: "assign-route-group",
  OPTIMIZE_ROUTES: "optimize-routes",
  SEND_EMAIL: "send-email",
  SEND_REMINDERS: "send-reminders",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];
export type JobHandler<T = unknown> = (data: T) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a handler for a job type
 */
export function registerHandler<T>(name: string, handler: JobHandler<T>) {
  handlers.set(name, handler as JobHandler);
}

/**
 * Schedule a job to run
 */
export async function scheduleJob<T extends object>(
  name: string,
  data: T,
  options?: { runAt?: Date; priority?: number; maxAttempts?: number }
) {
  return prisma.job.create({
    data: {
      name,
      data: data as object,
      runAt: options?.runAt ?? new Date(),
      priority: options?.priority ?? 0,
      maxAttempts: options?.maxAttempts ?? 3,
    },
  });
}

/**
 * Schedule a recurring job (creates if not already pending)
 */
export async function scheduleRecurring(
  name: string,
  cronExpression: string,
  options?: { timezone?: string }
) {
  const nextRun = getNextCronRun(cronExpression, options?.timezone);

  // Check if there's already a pending job of this type scheduled for the future
  const existing = await prisma.job.findFirst({
    where: {
      name,
      status: "PENDING",
      runAt: { gte: new Date() },
    },
  });

  if (!existing) {
    await prisma.job.create({
      data: {
        name,
        data: { recurring: true, cron: cronExpression, timezone: options?.timezone },
        runAt: nextRun,
        priority: -1, // Lower priority for recurring jobs
      },
    });
    console.log(`Scheduled recurring job ${name} for ${nextRun.toISOString()}`);
  }
}

/**
 * Process pending jobs (call this in a polling loop)
 */
export async function processJobs() {
  const now = new Date();

  // Find and claim a job atomically
  const job = await prisma.job.findFirst({
    where: {
      status: "PENDING",
      runAt: { lte: now },
    },
    orderBy: [{ priority: "desc" }, { runAt: "asc" }],
  });

  if (!job) return false;

  // Try to claim the job
  const updated = await prisma.job.updateMany({
    where: {
      id: job.id,
      status: "PENDING", // Only update if still pending (optimistic locking)
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    // Another worker claimed it
    return true; // Return true to indicate there may be more jobs
  }

  const handler = handlers.get(job.name);
  if (!handler) {
    console.error(`No handler registered for job type: ${job.name}`);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: `No handler registered for job type: ${job.name}`,
      },
    });
    return true;
  }

  try {
    await handler(job.data);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // If this was a recurring job, schedule the next one
    const jobData = job.data as { recurring?: boolean; cron?: string; timezone?: string };
    if (jobData.recurring && jobData.cron) {
      await scheduleRecurring(job.name, jobData.cron, { timezone: jobData.timezone });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Job ${job.id} (${job.name}) failed:`, errorMessage);

    if (job.attempts + 1 >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: errorMessage,
        },
      });
    } else {
      // Retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 300000); // Max 5 min
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          lastError: errorMessage,
          runAt: new Date(Date.now() + backoffMs),
        },
      });
    }
  }

  return true;
}

/**
 * Start the job processing loop
 */
let isPolling = false;
let pollInterval: NodeJS.Timeout | null = null;

export function startPolling(intervalMs = 1000) {
  if (isPolling) return;
  isPolling = true;

  const poll = async () => {
    try {
      // Process jobs until none are ready
      while (await processJobs()) {
        // Continue processing
      }
    } catch (error) {
      console.error("Job polling error:", error);
    }
  };

  // Initial poll
  poll();

  // Set up interval
  pollInterval = setInterval(poll, intervalMs);
  console.log(`Job queue polling started (interval: ${intervalMs}ms)`);
}

export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  isPolling = false;
  console.log("Job queue polling stopped");
}

/**
 * Simple cron parser for common patterns
 * Supports: "minute hour * * *" format
 */
function getNextCronRun(cron: string, timezone?: string): Date {
  const parts = cron.split(" ");
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cron}`);
  }

  const [minute, hour] = parts;
  const now = new Date();

  // Create date in the specified timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const tzParts = formatter.formatToParts(now);
  const tzNow = {
    year: parseInt(tzParts.find((p) => p.type === "year")?.value || "0"),
    month: parseInt(tzParts.find((p) => p.type === "month")?.value || "0") - 1,
    day: parseInt(tzParts.find((p) => p.type === "day")?.value || "0"),
    hour: parseInt(tzParts.find((p) => p.type === "hour")?.value || "0"),
    minute: parseInt(tzParts.find((p) => p.type === "minute")?.value || "0"),
  };

  const targetMinute = parseInt(minute);
  const targetHour = parseInt(hour);

  // Calculate next run
  let nextRun = new Date(
    tzNow.year,
    tzNow.month,
    tzNow.day,
    targetHour,
    targetMinute,
    0,
    0
  );

  // Adjust for timezone offset
  if (timezone) {
    const utcFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const utcParts = utcFormatter.formatToParts(now);
    const utcHour = parseInt(utcParts.find((p) => p.type === "hour")?.value || "0");
    const offset = tzNow.hour - utcHour;
    nextRun = new Date(nextRun.getTime() - offset * 60 * 60 * 1000);
  }

  // If the time has passed today, schedule for tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}
