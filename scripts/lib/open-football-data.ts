import * as fs from "node:fs";
import * as path from "node:path";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";

export interface OpenSourceFile {
  id: string;
  url: string;
  gzip?: boolean;
}

interface CacheMetadata {
  etag?: string;
  lastModified?: string;
  retrievedAt: string;
  url: string;
}

export async function downloadOpenSource(
  source: OpenSourceFile,
  cacheDirectory: string
): Promise<{ path: string; metadata: CacheMetadata; changed: boolean }> {
  fs.mkdirSync(cacheDirectory, { recursive: true });
  const extension = source.gzip ? ".csv.gz" : ".csv";
  const destination = path.join(cacheDirectory, `${source.id}${extension}`);
  const partial = `${destination}.partial`;
  const metadataPath = `${destination}.metadata.json`;
  const previous = fs.existsSync(metadataPath)
    ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) as CacheMetadata
    : null;

  const headers: Record<string, string> = {
    "User-Agent": "Zeds football database importer (open dataset sync)",
  };
  if (previous?.etag && fs.existsSync(destination)) {
    headers["If-None-Match"] = previous.etag;
  }
  if (previous?.lastModified && fs.existsSync(destination)) {
    headers["If-Modified-Since"] = previous.lastModified;
  }

  const response = await fetch(source.url, { headers });
  if (response.status === 304 && previous && fs.existsSync(destination)) {
    return { path: destination, metadata: previous, changed: false };
  }
  if (!response.ok || !response.body) {
    throw new Error(`Téléchargement impossible (${response.status}) : ${source.url}`);
  }

  if (fs.existsSync(partial)) fs.rmSync(partial);
  await pipeline(
    Readable.fromWeb(response.body as never),
    fs.createWriteStream(partial)
  );
  fs.renameSync(partial, destination);

  const metadata: CacheMetadata = {
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
    retrievedAt: new Date().toISOString(),
    url: source.url,
  };
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return { path: destination, metadata, changed: true };
}

export async function forEachCsvRow<T extends object>(
  filePath: string,
  gzip: boolean,
  callback: (row: T) => void | Promise<void>
): Promise<number> {
  const file = fs.createReadStream(filePath);
  const input = gzip ? file.pipe(createGunzip()) : file;
  const parser = input.pipe(parse({
    bom: true,
    columns: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }));

  let count = 0;
  for await (const row of parser) {
    await callback(row as T);
    count += 1;
  }
  return count;
}
