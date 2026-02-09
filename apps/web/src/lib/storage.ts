import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const baseDir = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage");

export async function storeTextAsset(prefix: string, content: string) {
  const dir = path.join(baseDir, prefix);
  await mkdir(dir, { recursive: true });
  const filename = `${prefix}-${randomUUID()}.txt`;
  const filepath = path.join(dir, filename);
  await writeFile(filepath, content, "utf8");
  return `file://${filepath}`;
}
