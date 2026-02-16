/**
 * Migration script to add serviceType field to existing documents.
 * Sets all existing documents to "SPRINKLER_BLOWOUT" (the original service type).
 *
 * Run with: npm run migrate:service-type
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprinklerBlowouts";

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();

    const bookingsResult = await db.collection("bookings").updateMany(
      { serviceType: { $exists: false } },
      { $set: { serviceType: "SPRINKLER_BLOWOUT" } }
    );
    console.log(`Updated ${bookingsResult.modifiedCount} bookings`);

    const datesResult = await db.collection("available_dates").updateMany(
      { serviceType: { $exists: false } },
      { $set: { serviceType: "SPRINKLER_BLOWOUT" } }
    );
    console.log(`Updated ${datesResult.modifiedCount} available_dates`);

    const routesResult = await db.collection("route_groups").updateMany(
      { serviceType: { $exists: false } },
      { $set: { serviceType: "SPRINKLER_BLOWOUT" } }
    );
    console.log(`Updated ${routesResult.modifiedCount} route_groups`);

    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
