/**
 * Seed script to populate bookings for testing
 *
 * Run with: npx tsx scripts/seed-bookings.ts
 *
 * Creates a mix of:
 * - Fully booked days (every time slot filled)
 * - Partially booked days (gaps between booked times)
 * - Available dates with MORNING, AFTERNOON, and EVENING slots
 */

import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprinklerBlowouts";

// Tri-Cities area addresses for realistic test data
const TEST_CUSTOMERS = [
  { name: "John Smith", email: "john.smith@test.com", phone: "509-555-0101", address: "1234 Jadwin Ave", city: "Richland", lat: 46.2856, lng: -119.2845 },
  { name: "Jane Doe", email: "jane.doe@test.com", phone: "509-555-0102", address: "567 George Washington Way", city: "Richland", lat: 46.2733, lng: -119.2784 },
  { name: "Bob Johnson", email: "bob.j@test.com", phone: "509-555-0103", address: "890 Clearwater Ave", city: "Kennewick", lat: 46.2112, lng: -119.1372 },
  { name: "Alice Williams", email: "alice.w@test.com", phone: "509-555-0104", address: "321 Columbia Center Blvd", city: "Kennewick", lat: 46.2181, lng: -119.2264 },
  { name: "Charlie Brown", email: "charlie.b@test.com", phone: "509-555-0105", address: "456 Road 68", city: "Pasco", lat: 46.2496, lng: -119.3027 },
  { name: "Diana Prince", email: "diana.p@test.com", phone: "509-555-0106", address: "789 Burden Blvd", city: "Pasco", lat: 46.2573, lng: -119.2911 },
  { name: "Edward Miller", email: "ed.miller@test.com", phone: "509-555-0107", address: "1100 Bombing Range Rd", city: "West Richland", lat: 46.3043, lng: -119.3614 },
  { name: "Fiona Garcia", email: "fiona.g@test.com", phone: "509-555-0108", address: "2200 Fallon Dr", city: "Richland", lat: 46.2661, lng: -119.3045 },
  { name: "George Wilson", email: "george.w@test.com", phone: "509-555-0109", address: "345 Gage Blvd", city: "Kennewick", lat: 46.1980, lng: -119.1810 },
  { name: "Helen Taylor", email: "helen.t@test.com", phone: "509-555-0110", address: "678 W Canal Dr", city: "Kennewick", lat: 46.2045, lng: -119.2590 },
  { name: "Ivan Rodriguez", email: "ivan.r@test.com", phone: "509-555-0111", address: "910 Stevens Dr", city: "Richland", lat: 46.2714, lng: -119.2632 },
  { name: "Julia Chen", email: "julia.c@test.com", phone: "509-555-0112", address: "1350 Lee Blvd", city: "Richland", lat: 46.2800, lng: -119.2900 },
  { name: "Kevin Park", email: "kevin.p@test.com", phone: "509-555-0113", address: "420 W 10th Ave", city: "Kennewick", lat: 46.2050, lng: -119.1470 },
  { name: "Laura Adams", email: "laura.a@test.com", phone: "509-555-0114", address: "555 Duportail St", city: "Richland", lat: 46.2590, lng: -119.2830 },
  { name: "Mike Thompson", email: "mike.t@test.com", phone: "509-555-0115", address: "700 Keene Rd", city: "Richland", lat: 46.2480, lng: -119.3110 },
  { name: "Nancy Lee", email: "nancy.l@test.com", phone: "509-555-0116", address: "880 W Hildebrand Blvd", city: "Kennewick", lat: 46.1920, lng: -119.2200 },
  { name: "Oscar Martinez", email: "oscar.m@test.com", phone: "509-555-0117", address: "1200 Sandifur Pkwy", city: "Pasco", lat: 46.2650, lng: -119.3100 },
  { name: "Patricia White", email: "pat.w@test.com", phone: "509-555-0118", address: "333 Thayer Dr", city: "Richland", lat: 46.2750, lng: -119.2670 },
  { name: "Quinn Harris", email: "quinn.h@test.com", phone: "509-555-0119", address: "1500 W 4th Ave", city: "Kennewick", lat: 46.2130, lng: -119.1600 },
  { name: "Rachel Scott", email: "rachel.s@test.com", phone: "509-555-0120", address: "250 Paradise Way", city: "West Richland", lat: 46.3100, lng: -119.3500 },
];

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
    let customerIdx = 0;
    let totalBookings = 0;

    function nextCustomer() {
      const c = TEST_CUSTOMERS[customerIdx % TEST_CUSTOMERS.length];
      customerIdx++;
      return c;
    }

    function uniqueJobNumber(): string {
      let jn: string;
      do {
        jn = generateJobNumber();
      } while (usedJobNumbers.has(jn));
      usedJobNumbers.add(jn);
      return jn;
    }

    // Define the test schedule
    // Days 1-3: fully booked (all slots filled)
    // Days 4-6: partially booked (gaps in schedule)
    // Days 7-9: lightly booked (just a few bookings)
    // Day 10: completely open (no bookings, just available dates)

    const schedule: Array<{
      daysFromNow: number;
      label: string;
      periods: Array<{ timeOfDay: string; bookedSlots: "all" | string[] }>;
    }> = [
      // FULLY BOOKED DAYS
      {
        daysFromNow: 2,
        label: "Fully booked day (all periods)",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: "all" },
          { timeOfDay: "AFTERNOON", bookedSlots: "all" },
          { timeOfDay: "EVENING", bookedSlots: "all" },
        ],
      },
      {
        daysFromNow: 3,
        label: "Fully booked morning & afternoon",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: "all" },
          { timeOfDay: "AFTERNOON", bookedSlots: "all" },
        ],
      },
      {
        daysFromNow: 5,
        label: "Fully booked morning only",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: "all" },
          { timeOfDay: "AFTERNOON", bookedSlots: ["12:30", "14:00"] },
          { timeOfDay: "EVENING", bookedSlots: ["17:00"] },
        ],
      },

      // PARTIALLY BOOKED DAYS (gaps between times)
      {
        daysFromNow: 7,
        label: "Partial morning (gaps), open afternoon",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: ["08:00", "09:30", "11:00"] }, // gaps at 08:45, 10:15, 11:45
          { timeOfDay: "AFTERNOON", bookedSlots: ["13:15", "15:30"] },        // gaps at 12:30, 14:00, 14:45
        ],
      },
      {
        daysFromNow: 8,
        label: "Scattered bookings across all periods",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: ["08:45", "10:15"] },    // gaps at 08:00, 09:30, 11:00, 11:45
          { timeOfDay: "AFTERNOON", bookedSlots: ["12:30", "14:45"] },  // gaps at 13:15, 14:00, 15:30
          { timeOfDay: "EVENING", bookedSlots: ["16:15"] },             // gaps at 17:00, 17:45
        ],
      },
      {
        daysFromNow: 10,
        label: "Afternoon only, partially booked",
        periods: [
          { timeOfDay: "AFTERNOON", bookedSlots: ["12:30", "13:15", "14:00"] }, // gaps at 14:45, 15:30
        ],
      },

      // LIGHTLY BOOKED DAYS
      {
        daysFromNow: 12,
        label: "Single morning booking",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: ["08:00"] },
          { timeOfDay: "AFTERNOON", bookedSlots: [] },
          { timeOfDay: "EVENING", bookedSlots: [] },
        ],
      },
      {
        daysFromNow: 14,
        label: "Two bookings, different periods",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: ["09:30"] },
          { timeOfDay: "EVENING", bookedSlots: ["17:45"] },
        ],
      },

      // COMPLETELY OPEN DAY
      {
        daysFromNow: 15,
        label: "Completely open (no bookings)",
        periods: [
          { timeOfDay: "MORNING", bookedSlots: [] },
          { timeOfDay: "AFTERNOON", bookedSlots: [] },
          { timeOfDay: "EVENING", bookedSlots: [] },
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

        // Determine which slots to book
        const slotsToBook =
          period.bookedSlots === "all"
            ? getSlotsForTimeOfDay(period.timeOfDay)
            : period.bookedSlots;

        if (slotsToBook.length === 0) {
          console.log(`  ${period.timeOfDay}: available (0 bookings)`);
          continue;
        }

        // Create bookings for each slot
        const bookingDocs = slotsToBook.map((time) => {
          const customer = nextCustomer();
          const now = new Date();
          return {
            jobNumber: uniqueJobNumber(),
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            address: customer.address,
            city: customer.city,
            state: "WA",
            zip: "99352",
            lat: customer.lat,
            lng: customer.lng,
            preferredTime: period.timeOfDay,
            bookedTime: time,
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

        const allSlots = getSlotsForTimeOfDay(period.timeOfDay);
        const openSlots = allSlots.filter((s) => !slotsToBook.includes(s));
        console.log(
          `  ${period.timeOfDay}: ${slotsToBook.length}/${allSlots.length} booked [${slotsToBook.join(", ")}]` +
          (openSlots.length > 0 ? ` | open: [${openSlots.join(", ")}]` : " | FULL")
        );
      }
    }

    console.log(`\n========================================`);
    console.log(`Seeding complete!`);
    console.log(`  Total bookings created: ${totalBookings}`);
    console.log(`  Available dates created: ${schedule.reduce((sum, d) => sum + d.periods.length, 0)}`);
    console.log(`  Date range: ${getDateString(2)} to ${getDateString(15)}`);
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
