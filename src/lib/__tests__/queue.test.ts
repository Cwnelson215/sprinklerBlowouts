import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/mongodb";
import { scheduleJob, processJobs, registerHandler, JOBS } from "../queue";

describe("scheduleJob", () => {
  it("inserts a job with correct defaults", async () => {
    const job = await scheduleJob("test-job", { foo: "bar" });
    expect(job.name).toBe("test-job");
    expect(job.status).toBe("PENDING");
    expect(job.priority).toBe(0);
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(3);
    expect(job.data).toEqual({ foo: "bar" });
    expect(job._id).toBeDefined();
  });

  it("respects custom options", async () => {
    const runAt = new Date("2027-01-01");
    const job = await scheduleJob("test-job", { x: 1 }, {
      runAt,
      priority: 5,
      maxAttempts: 1,
    });
    expect(job.priority).toBe(5);
    expect(job.maxAttempts).toBe(1);
    expect(job.runAt).toEqual(runAt);
  });
});

describe("processJobs", () => {
  it("claims a pending job and calls handler", async () => {
    let handlerCalled = false;
    let handlerData: unknown = null;
    registerHandler("process-test", async (data) => {
      handlerCalled = true;
      handlerData = data;
    });

    await scheduleJob("process-test", { key: "value" });
    const processed = await processJobs();

    expect(processed).toBe(true);
    expect(handlerCalled).toBe(true);
    expect(handlerData).toEqual({ key: "value" });

    // Verify job is marked COMPLETED
    const db = await getDb();
    const job = await db.collection("jobs").findOne({ name: "process-test" });
    expect(job!.status).toBe("COMPLETED");
    expect(job!.completedAt).toBeDefined();
  });

  it("marks job FAILED when no handler registered", async () => {
    await scheduleJob("no-handler-job", {});
    await processJobs();

    const db = await getDb();
    const job = await db.collection("jobs").findOne({ name: "no-handler-job" });
    expect(job!.status).toBe("FAILED");
    expect(job!.lastError).toContain("No handler registered");
  });

  it("retries with exponential backoff on handler failure", async () => {
    let callCount = 0;
    registerHandler("failing-job", async () => {
      callCount++;
      throw new Error("test failure");
    });

    await scheduleJob("failing-job", {});
    await processJobs();

    const db = await getDb();
    const job = await db.collection("jobs").findOne({ name: "failing-job" });
    // First attempt fails, should be set back to PENDING with a future runAt
    expect(job!.status).toBe("PENDING");
    expect(job!.lastError).toBe("test failure");
    expect(new Date(job!.runAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("marks job FAILED after exceeding maxAttempts", async () => {
    registerHandler("max-attempts-job", async () => {
      throw new Error("always fails");
    });

    await scheduleJob("max-attempts-job", {}, { maxAttempts: 1 });
    await processJobs();

    const db = await getDb();
    const job = await db.collection("jobs").findOne({ name: "max-attempts-job" });
    expect(job!.status).toBe("FAILED");
    expect(job!.lastError).toBe("always fails");
  });

  it("processes higher priority jobs first", async () => {
    const order: string[] = [];
    registerHandler("priority-test", async (data: unknown) => {
      const d = data as { name: string };
      order.push(d.name);
    });

    await scheduleJob("priority-test", { name: "low" }, { priority: 0 });
    await scheduleJob("priority-test", { name: "high" }, { priority: 10 });

    await processJobs();
    await processJobs();

    expect(order).toEqual(["high", "low"]);
  });

  it("returns false when no jobs to process", async () => {
    const result = await processJobs();
    expect(result).toBe(false);
  });
});

describe("JOBS constants", () => {
  it("has expected job names", () => {
    expect(JOBS.GEOCODE_ADDRESS).toBe("geocode-address");
    expect(JOBS.ASSIGN_ROUTE_GROUP).toBe("assign-route-group");
    expect(JOBS.OPTIMIZE_ROUTES).toBe("optimize-routes");
    expect(JOBS.SEND_EMAIL).toBe("send-email");
    expect(JOBS.SEND_REMINDERS).toBe("send-reminders");
  });
});
