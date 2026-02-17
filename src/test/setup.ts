import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { beforeAll, afterEach, afterAll } from "vitest";

let mongod: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = "test-jwt-secret-for-testing";
  process.env.EMAIL_DOMAIN = "test.example.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.example.com";
  process.env.NODE_ENV = "test";

  client = new MongoClient(uri);
  await client.connect();
});

afterEach(async () => {
  // Drop all collections for test isolation
  const db = client.db();
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).deleteMany({});
  }

  // Reset the module-level clientPromise so each test gets a fresh connection state
  // We need to reset both the module var and the global
  const mongoModule = await import("@/lib/mongodb");
  // Force reset by clearing the cached client promise
  (globalThis as Record<string, unknown>)._mongoClientPromise = undefined;
});

afterAll(async () => {
  await client.close();
  await mongod.stop();
});
