import { createDatabaseClient } from '@/lib/neon';

export async function createClient() {
  return createDatabaseClient();
}
