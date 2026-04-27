/**
 * Post-build script: reorganizes TanStack Start output into
 * Vercel Build Output API v3 format (.vercel/output/).
 *
 * Layout produced:
 *   .vercel/output/
 *     config.json                  ← routing rules
 *     static/                      ← client assets served by Vercel CDN
 *     functions/
 *       index.func/
 *         .vc-config.json          ← Node.js runtime config
 *         index.js                 ← Node.js adapter entry
 *         server/                  ← built SSR bundle (from dist/server/)
 */

import { mkdir, cp, writeFile, rm } from "fs/promises";

await rm(".vercel/output", { recursive: true, force: true });
await mkdir(".vercel/output/static", { recursive: true });
await mkdir(".vercel/output/functions/index.func/server", {
  recursive: true,
});

// 1. Static assets → Vercel CDN
console.log("Copying client assets...");
await cp("dist/client", ".vercel/output/static", { recursive: true });

// 2. SSR bundle → serverless function
console.log("Copying server bundle...");
await cp("dist/server", ".vercel/output/functions/index.func/server", {
  recursive: true,
});

// 3. Node.js adapter: bridges IncomingMessage/ServerResponse ↔ Web Fetch API
//    TanStack Start server entry exports { fetch: (Request) => Promise<Response> }
await writeFile(
  ".vercel/output/functions/index.func/index.js",
  `import serverEntry from "./server/index.js";

export default async function handler(req, res) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = proto + "://" + host + req.url;

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  // Deduplicate headers (Node.js can have arrays)
  const headers = {};
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const k = req.rawHeaders[i].toLowerCase();
    const v = req.rawHeaders[i + 1];
    headers[k] = headers[k] ? headers[k] + ", " + v : v;
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
    ...(body?.length ? { duplex: "half" } : {}),
  });

  const response = await serverEntry.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));

  if (response.body) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
    }
  } else {
    res.end();
  }
}
`
);

// 4. Function runtime config
await writeFile(
  ".vercel/output/functions/index.func/.vc-config.json",
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
    },
    null,
    2
  )
);

// 5. Routing: static files first, everything else → SSR function
await writeFile(
  ".vercel/output/config.json",
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2
  )
);

console.log("✅ .vercel/output/ ready for deployment");
