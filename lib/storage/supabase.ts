import "server-only";
import type { StorageDriver } from "./types";

/** Supabase Storage via its REST API using the service role key (server only). */
export class SupabaseStorageDriver implements StorageDriver {
  constructor(private url: string, private serviceKey: string, private bucket: string) {
    if (!url || !serviceKey) throw new Error("Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  private obj(p: string) {
    return `${this.url}/storage/v1/object/${this.bucket}/${p.split("/").map(encodeURIComponent).join("/")}`;
  }

  async put(p: string, data: Uint8Array, contentType: string) {
    const res = await fetch(this.obj(p), {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType, "x-upsert": "true" }),
      body: Buffer.from(data),
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
  }

  async get(p: string) {
    const res = await fetch(this.obj(p), { headers: this.headers() });
    if (!res.ok) throw new Error(`Storage download failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async exists(p: string) {
    const res = await fetch(this.obj(p), { method: "HEAD", headers: this.headers() });
    return res.ok;
  }

  async list(prefix: string) {
    return (await this.listDetailed(prefix)).map((f) => f.path);
  }

  async listDetailed(prefix: string) {
    const res = await fetch(`${this.url}/storage/v1/object/list/${this.bucket}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix: prefix.replace(/\/$/, ""), limit: 10000, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) return [];
    const items = (await res.json()) as { name: string; id: string | null; metadata?: { size?: number } }[];
    return items.filter((i) => i.id).map((i) => ({ path: `${prefix.replace(/\/$/, "")}/${i.name}`, size: i.metadata?.size ?? 0 }));
  }

  async delete(p: string) {
    await this.deleteMany([p]);
  }

  async deletePrefix(prefix: string) {
    const files = await this.list(prefix);
    if (files.length) await this.deleteMany(files);
  }

  private async deleteMany(prefixes: string[]) {
    await fetch(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes }),
    });
  }

  async signedUrl(p: string, ttlSeconds: number) {
    const res = await fetch(`${this.url}/storage/v1/object/sign/${this.bucket}/${p}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: ttlSeconds }),
    });
    if (!res.ok) throw new Error(`Could not sign storage URL (${res.status})`);
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${this.url}/storage/v1${signedURL}`;
  }
}
