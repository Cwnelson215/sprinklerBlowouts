import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprinklerBlowouts";

async function checkZones() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const zones = await db.collection('service_zones').find({}).toArray();
    console.log('Zones:', JSON.stringify(zones, null, 2));

    // Test haversine distance calculation
    const testLat = 46.279759506515;
    const testLng = -119.358324698404;

    for (const zone of zones) {
      const R = 3959; // Earth's radius in miles
      const dLat = toRad(zone.centerLat - testLat);
      const dLng = toRad(zone.centerLng - testLng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(testLat)) *
          Math.cos(toRad(zone.centerLat)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      console.log(`\nDistance from test address to "${zone.name}": ${distance.toFixed(2)} miles`);
      console.log(`Zone radius: ${zone.radiusMi} miles`);
      console.log(`Is active: ${zone.isActive}`);
      console.log(`In range: ${distance <= zone.radiusMi}`);
    }
  } finally {
    await client.close();
  }
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

checkZones();
