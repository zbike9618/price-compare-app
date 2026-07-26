// 最小限のCookie jar（同一ホスト内のセッション維持専用）
export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  storeFromResponse(res) {
    const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

export async function fetchWithJar(jar, url, options = {}) {
  const headers = {
    ...options.headers,
    ...(jar.header() ? { cookie: jar.header() } : {}),
  };
  const res = await fetch(url, { ...options, headers, redirect: "manual" });
  jar.storeFromResponse(res);

  const location = res.headers.get("location");
  if ((res.status === 301 || res.status === 302 || res.status === 303) && location) {
    const nextUrl = new URL(location, url).toString();
    return fetchWithJar(jar, nextUrl, { method: "GET", headers: { ...options.headers } });
  }
  return res;
}
