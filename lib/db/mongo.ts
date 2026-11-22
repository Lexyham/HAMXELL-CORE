import { MongoClient, type Db } from 'mongodb';
import type { HotDoc, HotStore } from './archiver';
import { HOT_COLLECTIONS } from './routing';

export const mongoConfigured = () => Boolean(process.env.MONGODB_URI);

const g = globalThis as unknown as { __hxcMongo?: Promise<MongoClient> | undefined; __hxcMongoIdx?: boolean };

function client(): Promise<MongoClient> {
  if (!g.__hxcMongo) {
    const c = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, maxPoolSize: 5 });
    g.__hxcMongo = c.connect().catch((e) => { g.__hxcMongo = undefined; throw e; });
  }
  return g.__hxcMongo;
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(process.env.MONGODB_DB || 'hamxell_core');
  if (!g.__hxcMongoIdx) {
    g.__hxcMongoIdx = true;
    try {
      await Promise.all([
        ...HOT_COLLECTIONS.map((c) => db.collection(c).createIndex({ createdAt: 1 })),
        db.collection('analytics_events').createIndex({ type: 1, createdAt: -1 }),
        db.collection('archive_runs').createIndex({ startedAt: -1 }),
      ]);
    } catch (e) {
      g.__hxcMongoIdx = false;
      console.error('mongo index creation failed', (e as Error).message);
    }
  }
  return db;
}

export const mongoHotStore: HotStore = {
  async fetchOld(collection, cutoff, limit) {
    const db = await getDb();
    return (await db.collection(collection).find({ createdAt: { $lt: cutoff } }).sort({ _id: 1 }).limit(limit).toArray()) as unknown as HotDoc[];
  },
  async deleteByIds(collection, ids) {
    const db = await getDb();
    const r = await db.collection(collection).deleteMany({ _id: { $in: ids as never[] } });
    return r.deletedCount;
  },
};

export async function pingMongo(): Promise<void> {
  await (await getDb()).command({ ping: 1 });
}
