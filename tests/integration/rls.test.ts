// Verifies PostgreSQL Row Level Security isolates tenants, independent of app code.
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 2, onnotice: () => {} }) : null;
const d = url ? describe : describe.skip;

d("row level security", () => {
  let orgA = "";
  let orgB = "";

  beforeAll(async () => {
    await sql!.begin(async (tx) => {
      await tx`select set_config('app.system', 'on', true)`;
      [{ id: orgA }] = await tx`insert into organizations (name, slug) values ('RLS A', ${"rls-a-" + Date.now()}) returning id`;
      [{ id: orgB }] = await tx`insert into organizations (name, slug) values ('RLS B', ${"rls-b-" + Date.now()}) returning id`;
      await tx`insert into jobs (organization_id, title) values (${orgA}, 'A job'), (${orgB}, 'B job')`;
    });
  });

  afterAll(async () => {
    await sql!.begin(async (tx) => {
      await tx`select set_config('app.system', 'on', true)`;
      await tx`delete from organizations where id in (${orgA}, ${orgB})`;
    });
    await sql!.end();
  });

  it("returns no tenant rows without an org context", async () => {
    const rows = await sql!`select * from jobs`;
    expect(rows.length).toBe(0);
  });

  it("only exposes the current org's rows, even without a WHERE clause", async () => {
    const rows = await sql!.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${orgA}, true)`;
      return tx`select organization_id from jobs`;
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.organization_id === orgA)).toBe(true);
  });

  it("blocks writes into another tenant", async () => {
    await expect(sql!.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${orgA}, true)`;
      await tx`insert into jobs (organization_id, title) values (${orgB}, 'sneaky')`;
    })).rejects.toThrow(/row-level security/);
  });

  it("cannot update another tenant's rows", async () => {
    const res = await sql!.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${orgA}, true)`;
      return tx`update jobs set title = 'hacked' where organization_id = ${orgB} returning id`;
    });
    expect(res.length).toBe(0);
  });

  it("hides identity tables outside the system context", async () => {
    const rows = await sql!`select * from sessions`;
    expect(rows.length).toBe(0);
  });
});
