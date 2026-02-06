export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerHandler, startPolling, scheduleRecurring, JOBS } = await import("./lib/queue");
    const { handleGeocodeJob } = await import("./lib/workers/geocode-worker");
    const { handleAssignRouteGroup, handleOptimizeRoutes } = await import("./lib/workers/route-worker");
    const { handleSendEmail, handleSendReminders } = await import("./lib/workers/email-worker");

    try {
      // Register job handlers
      registerHandler(JOBS.GEOCODE_ADDRESS, handleGeocodeJob);
      registerHandler(JOBS.ASSIGN_ROUTE_GROUP, handleAssignRouteGroup);
      registerHandler(JOBS.OPTIMIZE_ROUTES, handleOptimizeRoutes);
      registerHandler(JOBS.SEND_EMAIL, handleSendEmail);
      registerHandler(JOBS.SEND_REMINDERS, handleSendReminders);

      // Schedule recurring jobs
      await scheduleRecurring(JOBS.OPTIMIZE_ROUTES, "0 2 * * *", {
        timezone: "America/Denver",
      });
      await scheduleRecurring(JOBS.SEND_REMINDERS, "0 8 * * *", {
        timezone: "America/Denver",
      });

      // Start job processing
      startPolling(2000); // Poll every 2 seconds

      console.log("Job queue workers started successfully");
    } catch (error) {
      console.error("Failed to start job queue workers:", error);
    }
  }
}
