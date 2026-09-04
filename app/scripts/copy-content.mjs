// Copies the canonical content (tickets + rubric) from ../../content into src/content
// so the app builds standalone from app/. Run manually when content changes; also
// safe to run automatically before dev/build if desired.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const contentSrc = path.resolve(appRoot, "..", "content");
const contentDest = path.resolve(appRoot, "src", "content");

if (!existsSync(contentDest)) mkdirSync(contentDest, { recursive: true });

const ticketsJsonPath = path.join(contentSrc, "tickets.json");
const raw = readFileSync(ticketsJsonPath, "utf-8");
writeFileSync(path.join(contentDest, "tickets.json"), raw);

const rubricMd = readFileSync(path.join(contentSrc, "rubric.md"), "utf-8");
writeFileSync(path.join(contentDest, "rubric.md"), rubricMd);

const recruiterMd = readFileSync(path.join(contentSrc, "recruiter-block.md"), "utf-8");
writeFileSync(path.join(contentDest, "recruiter-block.md"), recruiterMd);

console.log(
  `Copied tickets.json (${JSON.parse(raw).tickets.length} tickets), rubric.md, and recruiter-block.md into src/content/`
);
