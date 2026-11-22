import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function install(dir) {
  if (!existsSync(path.join(dir, "node_modules"))) {
    execSync("npm install", { cwd: dir, stdio: "inherit" });
  }
}

install(path.join(root, "server"));
install(path.join(root, "web"));

const children = [];
function launch(cmd, args, name) {
  const child = spawn(cmd, args, { cwd: root, stdio: "inherit" });
  child.on("exit", (code) => {
    if (code) console.error(`${name} exited ${code}`);
  });
  children.push(child);
}

launch("python3", ["services/lab/server.py"], "lab");
launch("node", ["server/index.js"], "catalog");
launch("npm", ["run", "dev", "--prefix", "web"], "web");

console.log("\nPi Zero Lab  →  http://127.0.0.1:4743\n");

function stop() {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
