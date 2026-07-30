import * as fs from "node:fs";
import * as path from "node:path";
import { createGunzip, createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

const ROOT = path.resolve(__dirname, "..");
const databasePath = path.join(ROOT, "data/football.db");
const archivePath = path.join(ROOT, "data/football.db.gz");

async function pack() {
  if (!fs.existsSync(databasePath)) throw new Error("data/football.db est absent.");
  const partial = `${archivePath}.partial`;
  if (fs.existsSync(partial)) fs.rmSync(partial);
  await pipeline(
    fs.createReadStream(databasePath),
    createGzip({ level: 9 }),
    fs.createWriteStream(partial)
  );
  fs.renameSync(partial, archivePath);
  console.log(`Archive créée : ${(fs.statSync(archivePath).size / 1024 / 1024).toFixed(1)} Mo`);
}

async function ensure() {
  if (fs.existsSync(databasePath)) return;
  if (!fs.existsSync(archivePath)) {
    throw new Error(
      "Aucune base football disponible. Lance npm run football:refresh."
    );
  }
  const partial = `${databasePath}.partial`;
  if (fs.existsSync(partial)) fs.rmSync(partial);
  await pipeline(
    fs.createReadStream(archivePath),
    createGunzip(),
    fs.createWriteStream(partial)
  );
  fs.renameSync(partial, databasePath);
  console.log("data/football.db restaurée depuis l’archive.");
}

const command = process.argv[2];
(command === "pack" ? pack() : ensure()).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
