import { Readable } from "stream";

// unzipper Parse does not depend on AWS SDK (unlike Open), so it is safe for bundling.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parse = require("unzipper/lib/parse");

export async function readZipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  const entries = new Map<string, Buffer>();
  const tasks: Promise<void>[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = Readable.from(buffer);
    stream
      .pipe(Parse())
      .on("entry", (entry: { path: string; type?: string; autodrain: () => void; on: Function }) => {
        if (entry.type && entry.type !== "File") {
          entry.autodrain();
          return;
        }
        const task = new Promise<void>((res, rej) => {
          const chunks: Buffer[] = [];
          entry.on("data", (chunk: Buffer) => chunks.push(chunk));
          entry.on("end", () => {
            entries.set(entry.path, Buffer.concat(chunks));
            res();
          });
          entry.on("error", rej);
        });
        tasks.push(task);
      })
      .on("error", reject)
      .on("close", () => {
        Promise.all(tasks).then(() => resolve()).catch(reject);
      });
  });

  return entries;
}
