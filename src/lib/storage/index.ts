import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageMetadata = { size: number; contentType?: string; sha256?: string; modifiedAt?: Date };
export interface PrivateStorageProvider {
  put(key: string, data: Uint8Array, metadata?: { contentType?: string; sha256?: string }): Promise<StorageMetadata>;
  get(key: string): Promise<Buffer>;
  getStream(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
  delete(key: string, authorization?: { authorized: boolean }): Promise<void>;
  createSignedReadUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
  metadata(key: string): Promise<StorageMetadata | null>;
  sha256(key: string): Promise<string>;
}

export function safeStorageKey(input: string) {
  const key = input.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!key || key.includes("\0") || key.split("/").some((part) => part === ".." || part === ".")) throw new Error("Chave de armazenamento inválida.");
  return key;
}

export class LocalPrivateStorageProvider implements PrivateStorageProvider {
  constructor(private root = resolve(process.cwd())) {}
  private path(key: string) {
    const target = resolve(this.root, safeStorageKey(key));
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) throw new Error("Caminho fora do armazenamento privado.");
    return target;
  }
  async put(key: string, data: Uint8Array, metadata?: { contentType?: string; sha256?: string }) {
    const target = this.path(key); await mkdir(dirname(target), { recursive: true }); await writeFile(target, data);
    const info = await stat(target); return { size: info.size, contentType: metadata?.contentType, sha256: metadata?.sha256 ?? createHash("sha256").update(data).digest("hex"), modifiedAt: info.mtime };
  }
  get(key: string) { return readFile(this.path(key)); }
  async getStream(key: string) { await stat(this.path(key)); return createReadStream(this.path(key)); }
  async exists(key: string) { return stat(this.path(key)).then(() => true, () => false); }
  async delete(key: string, authorization?: { authorized: boolean }) { if (!authorization?.authorized) throw new Error("Exclusão não autorizada."); await unlink(this.path(key)); }
  async createSignedReadUrl() { return null; }
  async metadata(key: string) { return stat(this.path(key)).then((info) => ({ size: info.size, modifiedAt: info.mtime }), () => null); }
  async sha256(key: string) { return createHash("sha256").update(await this.get(key)).digest("hex"); }
}

export class ObjectStorageProvider implements PrivateStorageProvider {
  private client: S3Client; private bucket: string; private prefix: string;
  constructor(config = process.env, client?: S3Client) {
    if (!config.STORAGE_BUCKET || !config.STORAGE_REGION || !config.STORAGE_ACCESS_KEY_ID || !config.STORAGE_SECRET_ACCESS_KEY) throw new Error("Object storage privado incompleto.");
    this.bucket = config.STORAGE_BUCKET; this.prefix = (config.STORAGE_PREFIX ?? "").replace(/^\/|\/$/g, "");
    this.client = client ?? new S3Client({ region: config.STORAGE_REGION, endpoint: config.STORAGE_ENDPOINT || undefined,
      forcePathStyle: config.STORAGE_FORCE_PATH_STYLE === "true", credentials: { accessKeyId: config.STORAGE_ACCESS_KEY_ID, secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY } });
  }
  private key(key: string) { return [this.prefix, safeStorageKey(key)].filter(Boolean).join("/"); }
  async put(key: string, data: Uint8Array, metadata?: { contentType?: string; sha256?: string }) {
    const digest = metadata?.sha256 ?? createHash("sha256").update(data).digest("hex");
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key(key), Body: data, ContentType: metadata?.contentType, Metadata: { sha256: digest } }));
    return { size: data.byteLength, contentType: metadata?.contentType, sha256: digest };
  }
  async get(key: string) { const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) })); return Buffer.from(await result.Body!.transformToByteArray()); }
  async getStream(key: string) { const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) })); return result.Body as Readable; }
  async exists(key: string) { return this.metadata(key).then(Boolean); }
  async delete(key: string, authorization?: { authorized: boolean }) { if (!authorization?.authorized) throw new Error("Exclusão não autorizada."); await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(key) })); }
  async createSignedReadUrl(key: string, expiresInSeconds = 300) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) }), { expiresIn: Math.min(expiresInSeconds, 900) }); }
  async metadata(key: string) { try { const value = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(key) })); return { size: value.ContentLength ?? 0, contentType: value.ContentType, sha256: value.Metadata?.sha256, modifiedAt: value.LastModified }; } catch { return null; } }
  async sha256(key: string) { const metadata = await this.metadata(key); return metadata?.sha256 ?? createHash("sha256").update(await this.get(key)).digest("hex"); }
}

let singleton: PrivateStorageProvider | undefined;
export function privateStorage(environment = process.env) {
  singleton ??= environment.STORAGE_PROVIDER === "s3" ? new ObjectStorageProvider(environment) : new LocalPrivateStorageProvider();
  return singleton;
}
