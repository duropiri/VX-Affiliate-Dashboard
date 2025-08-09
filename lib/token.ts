import crypto from "crypto";

export function generatePersonalAccessToken(): string {
  const raw = crypto.randomBytes(32).toString("base64url");
  return `pat_${raw}`;
}

export function hashPersonalAccessToken(token: string): string {
  // Hash the full token value including the pat_ prefix to avoid ambiguity
  return crypto.createHash("sha256").update(token).digest("hex");
}


