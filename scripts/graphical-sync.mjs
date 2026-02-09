import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "apps", "graphical", "build");
const target = path.join(root, "apps", "web", "public", "graphical");

if (!existsSync(source)) {
  console.error(
    `Scratch GUI build output not found at ${source}.\n` +
      "Run: npm --prefix apps/graphical install && npm --prefix apps/graphical run build"
  );
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`Synced scratch-gui build to ${target}`);
