import { copyFile } from "node:fs/promises";

await copyFile("staticwebapp.config.json", "dist/staticwebapp.config.json");