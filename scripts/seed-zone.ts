/**
 * Seed script to create West Richland service zone
 *
 * Run with: npm run seed:zone
 *
 * This creates a service zone centered on West Richland, WA
 * with a 20-mile radius covering the Tri-Cities area.
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprinklerBlowouts";

// West Richland, WA coordinates
const ZONE_CONFIG = {
  name: "Tri-Cities Area",
  centerLat: 46.3043,
  centerLng: -119.3614,
  radiusMi: 20,
  isActive: true,
};

async function seedZone() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const zonesCollection = db.collection("zones");

    // Check if zone already exists
    const existingZone = await zonesCollection.findOne({ name: ZONE_CONFIG.name });

    if (existingZone) {
      console.log(`Zone "${ZONE_CONFIG.name}" already exists with id: ${existingZone._id}`);
      console.log("Updating zone configuration...");

      await zonesCollection.updateOne(
        { _id: existingZone._id },
        {
          $set: {
            centerLat: ZONE_CONFIG.centerLat,
            centerLng: ZONE_CONFIG.centerLng,
            radiusMi: ZONE_CONFIG.radiusMi,
            isActive: ZONE_CONFIG.isActive,
            updatedAt: new Date(),
          },
        }
      );

      console.log("Zone updated successfully");
    } else {
      const result = await zonesCollection.insertOne({
        ...ZONE_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`Zone "${ZONE_CONFIG.name}" created with id: ${result.insertedId}`);
    }

    console.log("\nZone Details:");
    console.log(`  Name: ${ZONE_CONFIG.name}`);
    console.log(`  Center: ${ZONE_CONFIG.centerLat}, ${ZONE_CONFIG.centerLng}`);
    console.log(`  Radius: ${ZONE_CONFIG.radiusMi} miles`);
    console.log(`  Active: ${ZONE_CONFIG.isActive}`);
    console.log("\nService area includes:");
    console.log("  - West Richland");
    console.log("  - Richland");
    console.log("  - Kennewick");
    console.log("  - Pasco");
    console.log("  - Benton City");
    console.log("  - Finley");
    console.log("  - Burbank");
    console.log("  - Parts of Prosser");
  } catch (error) {
    console.error("Error seeding zone:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\nDisconnected from MongoDB");
  }
}

seedZone();
