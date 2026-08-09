import fs from "node:fs/promises";
import path from "node:path";

// Path to nonce.json in the project root
const FILE_PATH = path.resolve(
  process.cwd(),
  "tasks/deployment/lib/nonce.json"
);

interface NonceData {
  nonce: number;
}

export async function readNonce(): Promise<number> {
  const content = await fs.readFile(FILE_PATH, "utf-8");
  const data: NonceData = JSON.parse(content);
  return data.nonce;
}

export async function increaseNonce(): Promise<number> {
  const currentNonce = await readNonce();
  const nextNonce = currentNonce + 1;
  const updatedData: NonceData = { nonce: nextNonce };

  await fs.writeFile(FILE_PATH, JSON.stringify(updatedData, null, 2), "utf-8");
  return nextNonce;
}
