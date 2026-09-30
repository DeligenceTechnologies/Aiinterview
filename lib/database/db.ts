import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

const globalForDb = globalThis as unknown as { __sql?: Sql };

function client(): Sql {
  if (!globalForDb.__sql) {
    globalForDb.__sql = postgres(env().DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      transform: { undefined: null },
      onnotice: () => {},
    });
  }
  return globalForDb.__sql;
}

/**
 * Run queries scoped to one organization. Row Level Security policies read
 * `app.org_id`, so even a query that forgets an organization filter cannot
 * leak another tenant's rows. Service code still filters explicitly.
 */
export async function withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin(async (tx) => {
    await tx`select set_config('app.org_id', ${orgId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

/**
 * System context: authentication bootstrap, public token resolution and
 * background workers. Use sparingly and never with user-controlled org ids.
 */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin(async (tx) => {
    await tx`select set_config('app.system', 'on', true)`;
    return fn(tx);
  }) as Promise<T>;
}

export function json(value: unknown) {
  return client().json(value as postgres.JSONValue);
}
