import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium", "mongodb", "unpdf", "mammoth", "docx"],
  // Serverless Chromium ships its binary as brotli archives that file tracing does not pick up on its own.
  outputFileTracingIncludes: {
    "/api/projects/[id]/export": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/share/[...slug]": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
