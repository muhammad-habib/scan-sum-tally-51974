import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Voucher, Batch } from '@/types/voucher';

interface VoucherDB extends DBSchema {
  vouchers: {
    key: string;
    value: Voucher;
    indexes: { 'by-date': number };
  };
  batches: {
    key: string;
    value: Batch;
    indexes: { 'by-date': number };
  };
}

let dbPromise: Promise<IDBPDatabase<VoucherDB>>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VoucherDB>('voucher-scanner', 1, {
      upgrade(db) {
        const voucherStore = db.createObjectStore('vouchers', { keyPath: 'id' });
        voucherStore.createIndex('by-date', 'createdAt');

        const batchStore = db.createObjectStore('batches', { keyPath: 'id' });
        batchStore.createIndex('by-date', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function saveVoucher(voucher: Voucher): Promise<void> {
  const db = await getDB();
  await db.put('vouchers', voucher);
}

export async function getVoucher(id: string): Promise<Voucher | undefined> {
  const db = await getDB();
  return db.get('vouchers', id);
}

export async function getAllVouchers(): Promise<Voucher[]> {
  const db = await getDB();
  return db.getAllFromIndex('vouchers', 'by-date');
}

export async function deleteVoucher(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('vouchers', id);
}

export async function clearAllVouchers(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('vouchers', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function saveBatch(batch: Batch): Promise<void> {
  const db = await getDB();
  await db.put('batches', batch);
}

export async function getAllBatches(): Promise<Batch[]> {
  const db = await getDB();
  return db.getAllFromIndex('batches', 'by-date');
}
