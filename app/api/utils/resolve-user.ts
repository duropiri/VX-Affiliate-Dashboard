export { resolveUser as resolveExternalUser } from "@/lib/ext-auth";

// Helper to extract Bearer token and check if it is a PAT
export function extractBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}


