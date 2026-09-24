import { createDatabaseClient } from '@/lib/neon';

export function createAdminClient() {
  return createDatabaseClient();
}
