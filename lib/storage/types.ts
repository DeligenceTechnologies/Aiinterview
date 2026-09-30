export interface StorageDriver {
  put(path: string, data: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  /** Short-lived URL that grants read access to one object. */
  signedUrl(path: string, ttlSeconds: number, contentType?: string): Promise<string>;
}
