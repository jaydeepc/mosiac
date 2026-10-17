import { MongoClient, Db, ObjectId, Collection } from "mongodb";
import bcrypt from "bcryptjs";
import { config } from "./config";
import type { UserDoc, ProjectDoc, FileDoc, ArtDoc } from "./types";

declare global {
  var __mosaicMongo: { client: MongoClient; promise: Promise<MongoClient> } | undefined;
}

async function getClient(): Promise<MongoClient> {
  if (!global.__mosaicMongo) {
    const client = new MongoClient(config.mongoUri(), { maxPoolSize: 10 });
    global.__mosaicMongo = { client, promise: client.connect() };
  }
  return global.__mosaicMongo.promise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(config.mongoDb);
}

export async function users(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}
export async function projects(): Promise<Collection<ProjectDoc>> {
  return (await getDb()).collection<ProjectDoc>("projects");
}
export async function files(): Promise<Collection<FileDoc>> {
  return (await getDb()).collection<FileDoc>("files");
}
export async function art(): Promise<Collection<ArtDoc>> {
  return (await getDb()).collection<ArtDoc>("art");
}

let indexed = false;
let adminEnsured = false;

/** Creates indexes + the admin account on first use. Idempotent. */
export async function ensureSetup(): Promise<void> {
  if (!indexed) {
    const db = await getDb();
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("projects").createIndex({ userId: 1, updatedAt: -1 }),
      db.collection("projects").createIndex({ shareSlug: 1 }, { sparse: true }),
      db.collection("files").createIndex({ userId: 1 }),
      db.collection("art").createIndex({ key: 1 }, { unique: true }),
    ]);
    indexed = true;
  }
  if (!adminEnsured) {
    const col = await users();
    const existing = await col.findOne({ email: config.admin.email });
    if (!existing) {
      await col.insertOne({
        _id: new ObjectId(),
        email: config.admin.email,
        name: config.admin.name,
        passwordHash: await bcrypt.hash(config.admin.password, 10),
        role: "admin",
        active: true,
        language: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (existing.role !== "admin" || !existing.active) {
      await col.updateOne({ _id: existing._id }, { $set: { role: "admin", active: true } });
    }
    adminEnsured = true;
  }
}

export { ObjectId };
export function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}
