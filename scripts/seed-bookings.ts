/**
 * Seed script to populate bookings for testing
 *
 * Run with: npx tsx scripts/seed-bookings.ts
 *
 * Creates a mix of:
 * - Fully booked days (every time slot filled)
 * - Partially booked days (gaps between booked times)
 * - Available dates with MORNING, AFTERNOON, and EVENING slots
 *
 * Customers are organized into tight neighborhood clusters (~0.2 miles)
 * so that DBSCAN (epsilon=0.5 miles) groups them into multi-stop routes.
 */

import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprinklerBlowouts";

// 7 neighborhood clusters of 5 customers each (35 total)
// Each cluster's coordinates stay within ~0.003° lat / ~0.004° lng (~0.2 miles)
// Clusters are separated by >0.5 miles to prevent cross-cluster merging
const CLUSTERS: Record<string, Array<{
  name: string; email: string; phone: string;
  address: string; city: string; zip: string;
  lat: number; lng: number;
}>> = {
  "Meadow Springs": [
    { name: "John Smith", email: "john.smith@test.com", phone: "509-555-0101", address: "1234 Meadow Springs Ln", city: "West Richland", zip: "99353", lat: 46.2810, lng: -119.3550 },
    { name: "Jane Doe", email: "jane.doe@test.com", phone: "509-555-0102", address: "1240 Meadow Springs Ln", city: "West Richland", zip: "99353", lat: 46.2813, lng: -119.3545 },
    { name: "Bob Johnson", email: "bob.j@test.com", phone: "509-555-0103", address: "1300 Meadow Hills Dr", city: "West Richland", zip: "99353", lat: 46.2807, lng: -119.3555 },
    { name: "Alice Williams", email: "alice.w@test.com", phone: "509-555-0104", address: "1312 Meadow Hills Dr", city: "West Richland", zip: "99353", lat: 46.2815, lng: -119.3540 },
    { name: "Charlie Brown", email: "charlie.b@test.com", phone: "509-555-0105", address: "1250 Willow Creek Ct", city: "West Richland", zip: "99353", lat: 46.2818, lng: -119.3548 },
  ],
  "Horn Rapids": [
    { name: "Diana Prince", email: "diana.p@test.com", phone: "509-555-0106", address: "2450 Horn Rapids Rd", city: "Richland", zip: "99352", lat: 46.2540, lng: -119.3060 },
    { name: "Edward Miller", email: "ed.miller@test.com", phone: "509-555-0107", address: "2460 Horn Rapids Rd", city: "Richland", zip: "99352", lat: 46.2543, lng: -119.3055 },
    { name: "Fiona Garcia", email: "fiona.g@test.com", phone: "509-555-0108", address: "2470 Horn Rapids Rd", city: "Richland", zip: "99352", lat: 46.2537, lng: -119.3065 },
    { name: "George Wilson", email: "george.w@test.com", phone: "509-555-0109", address: "1105 Sagebrush Ct", city: "Richland", zip: "99352", lat: 46.2545, lng: -119.3050 },
    { name: "Helen Taylor", email: "helen.t@test.com", phone: "509-555-0110", address: "1110 Sagebrush Ct", city: "Richland", zip: "99352", lat: 46.2535, lng: -119.3070 },
  ],
  "Central Richland": [
    { name: "Ivan Rodriguez", email: "ivan.r@test.com", phone: "509-555-0111", address: "567 Jadwin Ave", city: "Richland", zip: "99352", lat: 46.2730, lng: -119.2780 },
    { name: "Julia Chen", email: "julia.c@test.com", phone: "509-555-0112", address: "575 Jadwin Ave", city: "Richland", zip: "99352", lat: 46.2733, lng: -119.2775 },
    { name: "Kevin Park", email: "kevin.p@test.com", phone: "509-555-0113", address: "580 Comstock St", city: "Richland", zip: "99352", lat: 46.2727, lng: -119.2785 },
    { name: "Laura Adams", email: "laura.a@test.com", phone: "509-555-0114", address: "590 Comstock St", city: "Richland", zip: "99352", lat: 46.2735, lng: -119.2770 },
    { name: "Mike Thompson", email: "mike.t@test.com", phone: "509-555-0115", address: "600 Williams Blvd", city: "Richland", zip: "99352", lat: 46.2725, lng: -119.2790 },
  ],
  "Southridge": [
    { name: "Nancy Lee", email: "nancy.l@test.com", phone: "509-555-0116", address: "4510 S Ely St", city: "Kennewick", zip: "99338", lat: 46.2060, lng: -119.2350 },
    { name: "Oscar Martinez", email: "oscar.m@test.com", phone: "509-555-0117", address: "4520 S Ely St", city: "Kennewick", zip: "99338", lat: 46.2063, lng: -119.2345 },
    { name: "Patricia White", email: "pat.w@test.com", phone: "509-555-0118", address: "4530 S Kent St", city: "Kennewick", zip: "99338", lat: 46.2057, lng: -119.2355 },
    { name: "Quinn Harris", email: "quinn.h@test.com", phone: "509-555-0119", address: "4540 S Kent St", city: "Kennewick", zip: "99338", lat: 46.2065, lng: -119.2340 },
    { name: "Rachel Scott", email: "rachel.s@test.com", phone: "509-555-0120", address: "4550 Southridge Blvd", city: "Kennewick", zip: "99338", lat: 46.2055, lng: -119.2360 },
  ],
  "Central Kennewick": [
    { name: "Sam Turner", email: "sam.t@test.com", phone: "509-555-0121", address: "420 W 10th Ave", city: "Kennewick", zip: "99336", lat: 46.2115, lng: -119.1500 },
    { name: "Tina Brooks", email: "tina.b@test.com", phone: "509-555-0122", address: "430 W 10th Ave", city: "Kennewick", zip: "99336", lat: 46.2118, lng: -119.1495 },
    { name: "Umar Khan", email: "umar.k@test.com", phone: "509-555-0123", address: "440 W Kennewick Ave", city: "Kennewick", zip: "99336", lat: 46.2112, lng: -119.1505 },
    { name: "Vera Nguyen", email: "vera.n@test.com", phone: "509-555-0124", address: "450 W Kennewick Ave", city: "Kennewick", zip: "99336", lat: 46.2120, lng: -119.1490 },
    { name: "Will Foster", email: "will.f@test.com", phone: "509-555-0125", address: "460 N Washington St", city: "Kennewick", zip: "99336", lat: 46.2110, lng: -119.1510 },
  ],
  "Pasco Road 68": [
    { name: "Xena Lopez", email: "xena.l@test.com", phone: "509-555-0126", address: "1200 Sandifur Pkwy", city: "Pasco", zip: "99301", lat: 46.2650, lng: -119.3100 },
    { name: "Yoshi Tanaka", email: "yoshi.t@test.com", phone: "509-555-0127", address: "1210 Sandifur Pkwy", city: "Pasco", zip: "99301", lat: 46.2653, lng: -119.3095 },
    { name: "Zara Patel", email: "zara.p@test.com", phone: "509-555-0128", address: "1220 Road 68", city: "Pasco", zip: "99301", lat: 46.2647, lng: -119.3105 },
    { name: "Aaron Bell", email: "aaron.b@test.com", phone: "509-555-0129", address: "1230 Road 68", city: "Pasco", zip: "99301", lat: 46.2655, lng: -119.3090 },
    { name: "Brenda Moss", email: "brenda.m@test.com", phone: "509-555-0130", address: "1240 Burden Blvd", city: "Pasco", zip: "99301", lat: 46.2645, lng: -119.3110 },
  ],
  "Bombing Range": [
    { name: "Carl Dixon", email: "carl.d@test.com", phone: "509-555-0131", address: "1100 Bombing Range Rd", city: "West Richland", zip: "99353", lat: 46.3040, lng: -119.3610 },
    { name: "Deb Owens", email: "deb.o@test.com", phone: "509-555-0132", address: "1110 Bombing Range Rd", city: "West Richland", zip: "99353", lat: 46.3043, lng: -119.3605 },
    { name: "Eli Reeves", email: "eli.r@test.com", phone: "509-555-0133", address: "1120 Paradise Way", city: "West Richland", zip: "99353", lat: 46.3037, lng: -119.3615 },
    { name: "Faith Grant", email: "faith.g@test.com", phone: "509-555-0134", address: "1130 Paradise Way", city: "West Richland", zip: "99353", lat: 46.3045, lng: -119.3600 },
    { name: "Glen Perry", email: "glen.p@test.com", phone: "509-555-0135", address: "1140 Flat Top Ct", city: "West Richland", zip: "99353", lat: 46.3035, lng: -119.3620 },
  ],
};

// Flat list for any fallback usage
const TEST_CUSTOMERS = Object.values(CLUSTERS).flat();

// Time slots for each period (45-min increments)
const MORNING_SLOTS = ["08:00", "08:45", "09:30", "10:15", "11:00", "11:45"];
const AFTERNOON_SLOTS = ["12:30", "13:15", "14:00", "14:45", "15:30"];
const EVENING_SLOTS = ["16:15", "17:00", "17:45"];

const ALL_TIME_OF_DAY = ["MORNING", "AFTERNOON", "EVENING"] as const;

function generateJobNumber(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SB-${year}-${code}`;
}

function getSlotsForTimeOfDay(timeOfDay: string): string[] {
  switch (timeOfDay) {
    case "MORNING": return MORNING_SLOTS;
    case "AFTERNOON": return AFTERNOON_SLOTS;
    case "EVENING": return EVENING_SLOTS;
    default: return [];
  }
}

function getDateString(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function makeDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

// Cluster-aware customer selection: draws N customers from a named cluster,
// cycling within that cluster to avoid duplicates where possible.
const clusterCounters: Record<string, number> = {};

function getCustomersFromCluster(clusterName: string, count: number) {
  const cluster = CLUSTERS[clusterName];
  if (!cluster) throw new Error(`Unknown cluster: ${clusterName}`);
  if (!(clusterName in clusterCounters)) clusterCounters[clusterName] = 0;

  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(cluster[clusterCounters[clusterName] % cluster.length]);
    clusterCounters[clusterName]++;
  }
  return result;
}

async function seedBookings() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const bookingsCol = db.collection("bookings");
    const availableDatesCol = db.collection("available_dates");
    const zonesCol = db.collection("service_zones");

    // Find the service zone
    const zone = await zonesCol.findOne({ isActive: true });
    if (!zone) {
      console.error("No active service zone found. Run `npm run seed:zone` first.");
      process.exit(1);
    }
    console.log(`Using zone: ${zone.name} (${zone._id})`);

    // Clear existing test bookings and available dates
    const deletedBookings = await bookingsCol.deleteMany({});
    const deletedDates = await availableDatesCol.deleteMany({});
    console.log(`Cleared ${deletedBookings.deletedCount} existing bookings`);
    console.log(`Cleared ${deletedDates.deletedCount} existing available dates`);

    const usedJobNumbers = new Set<string>();
    let totalBookings = 0;

    function uniqueJobNumber(): string {
      let jn: string;
      do {
        jn = generateJobNumber();
      } while (usedJobNumbers.has(jn));
      usedJobNumbers.add(jn);
      return jn;
    }

    // Define the test schedule with cluster-aware booking assignments
    // Each period specifies which clusters to draw customers from
    const schedule: Array<{
      daysFromNow: number;
      label: string;
      periods: Array<{
        timeOfDay: string;
        clusters: Array<{ name: string; count: number }>;
      }>;
    }> = [
      // Day +2: Fully booked, all periods (14 bookings)
      {
        daysFromNow: 2,
        label: "Fully booked day (all periods) — 14 bookings",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Meadow Springs", count: 3 }, { name: "Bombing Range", count: 3 }] },
          { timeOfDay: "AFTERNOON", clusters: [{ name: "Central Richland", count: 3 }, { name: "Southridge", count: 2 }] },
          { timeOfDay: "EVENING", clusters: [{ name: "Horn Rapids", count: 3 }] },
        ],
      },
      // Day +3: Fully booked morning & afternoon (11 bookings)
      {
        daysFromNow: 3,
        label: "Fully booked morning & afternoon — 11 bookings",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Horn Rapids", count: 3 }, { name: "Pasco Road 68", count: 3 }] },
          { timeOfDay: "AFTERNOON", clusters: [{ name: "Central Kennewick", count: 3 }, { name: "Meadow Springs", count: 2 }] },
        ],
      },
      // Day +5: Full morning, partial afternoon/evening (9 bookings)
      {
        daysFromNow: 5,
        label: "Full morning, partial afternoon & evening — 9 bookings",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Southridge", count: 3 }, { name: "Central Richland", count: 3 }] },
          { timeOfDay: "AFTERNOON", clusters: [{ name: "Bombing Range", count: 2 }] },
          { timeOfDay: "EVENING", clusters: [{ name: "Pasco Road 68", count: 1 }] },
        ],
      },
      // Day +7: Partial (5 bookings)
      {
        daysFromNow: 7,
        label: "Partial — 5 bookings",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Central Kennewick", count: 3 }] },
          { timeOfDay: "AFTERNOON", clusters: [{ name: "Meadow Springs", count: 2 }] },
        ],
      },
      // Day +8: Scattered (5 bookings)
      {
        daysFromNow: 8,
        label: "Scattered bookings — 5 bookings",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Central Richland", count: 2 }] },
          { timeOfDay: "AFTERNOON", clusters: [{ name: "Pasco Road 68", count: 2 }] },
          { timeOfDay: "EVENING", clusters: [{ name: "Horn Rapids", count: 1 }] },
        ],
      },
      // Day +10: Afternoon only (3 bookings)
      {
        daysFromNow: 10,
        label: "Afternoon only — 3 bookings",
        periods: [
          { timeOfDay: "AFTERNOON", clusters: [{ name: "Southridge", count: 3 }] },
        ],
      },
      // Day +12: Single booking
      {
        daysFromNow: 12,
        label: "Single morning booking — 1 booking",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Bombing Range", count: 1 }] },
          { timeOfDay: "AFTERNOON", clusters: [] },
          { timeOfDay: "EVENING", clusters: [] },
        ],
      },
      // Day +14: Two bookings in different periods
      {
        daysFromNow: 14,
        label: "Two bookings, different periods — 2 bookings",
        periods: [
          { timeOfDay: "MORNING", clusters: [{ name: "Central Kennewick", count: 1 }] },
          { timeOfDay: "EVENING", clusters: [{ name: "Horn Rapids", count: 1 }] },
        ],
      },
      // Day +15: Completely open
      {
        daysFromNow: 15,
        label: "Completely open (no bookings)",
        periods: [
          { timeOfDay: "MORNING", clusters: [] },
          { timeOfDay: "AFTERNOON", clusters: [] },
          { timeOfDay: "EVENING", clusters: [] },
        ],
      },
    ];

    for (const day of schedule) {
      const dateStr = getDateString(day.daysFromNow);
      const date = makeDate(dateStr);
      console.log(`\n--- ${dateStr}: ${day.label} ---`);

      for (const period of day.periods) {
        // Create available date entry
        const availDateDoc = {
          zoneId: zone._id,
          date,
          timeOfDay: period.timeOfDay,
          maxBookings: getSlotsForTimeOfDay(period.timeOfDay).length,
          disabledTimes: [] as string[],
          createdAt: new Date(),
        };
        const availResult = await availableDatesCol.insertOne(availDateDoc);
        const availDateId = availResult.insertedId;

        // Gather customers from specified clusters
        const customers: typeof TEST_CUSTOMERS = [];
        for (const spec of period.clusters) {
          customers.push(...getCustomersFromCluster(spec.name, spec.count));
        }

        if (customers.length === 0) {
          console.log(`  ${period.timeOfDay}: available (0 bookings)`);
          continue;
        }

        // Assign time slots sequentially from the period's slot list
        const allSlots = getSlotsForTimeOfDay(period.timeOfDay);
        const slotsToBook = allSlots.slice(0, customers.length);

        // Create bookings for each customer/slot pair
        const bookingDocs = customers.map((customer, i) => {
          const now = new Date();
          return {
            jobNumber: uniqueJobNumber(),
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            address: customer.address,
            city: customer.city,
            state: "WA",
            zip: customer.zip,
            lat: customer.lat,
            lng: customer.lng,
            preferredTime: period.timeOfDay,
            bookedTime: slotsToBook[i],
            status: "SCHEDULED",
            notes: null,
            zoneId: zone._id,
            availableDateId: availDateId,
            routeGroupId: null,
            routeOrder: null,
            createdAt: now,
            updatedAt: now,
          };
        });

        await bookingsCol.insertMany(bookingDocs);
        totalBookings += bookingDocs.length;

        const openSlots = allSlots.filter((s) => !slotsToBook.includes(s));
        const clusterSummary = period.clusters.map((c) => `${c.name} x${c.count}`).join(", ");
        console.log(
          `  ${period.timeOfDay}: ${slotsToBook.length}/${allSlots.length} booked [${clusterSummary}]` +
          (openSlots.length > 0 ? ` | open: ${openSlots.length} slots` : " | FULL")
        );
      }
    }

    console.log(`\n========================================`);
    console.log(`Seeding complete!`);
    console.log(`  Total bookings created: ${totalBookings}`);
    console.log(`  Available dates created: ${schedule.reduce((sum, d) => sum + d.periods.length, 0)}`);
    console.log(`  Date range: ${getDateString(2)} to ${getDateString(15)}`);
    console.log(`  Clusters used: ${Object.keys(CLUSTERS).join(", ")}`);
    console.log(`========================================`);
  } catch (error) {
    console.error("Error seeding bookings:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

seedBookings();
