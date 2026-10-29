import "server-only";

export function autenticacionConfigurada(): boolean {
  const { NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!NEXTAUTH_URL || !NEXTAUTH_SECRET || Buffer.byteLength(NEXTAUTH_SECRET) < 32
      || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return false;
  try {
    const url = new URL(NEXTAUTH_URL);
    return (url.protocol === "https:"
      || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
