import { createApp } from "../server/app";
import path from "path";

const cwd = path.resolve(process.env.CWD || process.cwd());
const port = parseInt(process.env.PORT || "0", 10);

const app = await createApp({ cwd, port, dryRun: true });

console.log(`cmux-diff dev server at http://127.0.0.1:${app.server.port}`);
console.log(`Watching: ${cwd}`);
