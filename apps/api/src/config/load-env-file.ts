import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Charge le fichier .env de la racine du dépôt, hors production. */
export function loadLocalEnvFile(): void {
  if (process.env.NODE_ENV === "production") return;
  const path = resolve(process.cwd(), "../../.env");
  if (existsSync(path)) process.loadEnvFile(path);
}
