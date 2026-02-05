export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getQueue, JOBS } = await import("./lib/queue");
    const { registerGeocodeWorker } = await import("./lib/workers/geocode-worker");
    const { registerRouteWorkers } = await import("./lib/workers/route-worker");
    const { registerEmailWorkers } = await import("./lib/workers/email-worker");

    try {
      const boss = await getQueue();
      await boss.start();

      registerGeocodeWorker(boss);
      registerRouteWorkers(boss);
      registerEmailWorkers(boss);

      // Schedule recurring jobs
      await boss.schedule(JOBS.OPTIMIZE_ROUTES, "0 2 * * *", {}, {
        tz: "America/Denver",
      });
      await boss.schedule(JOBS.SEND_REMINDERS, "0 8 * * *", {}, {
        tz: "America/Denver",
      });

      console.log("pg-boss workers started successfully");
    } catch (error) {
      console.error("Failed to start pg-boss workers:", error);
    }
  }
}
