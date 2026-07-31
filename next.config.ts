import type { NextConfig } from "next";
import { createContentSecurityPolicy } from "./src/lib/content-security-policy";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  serverExternalPackages: ["bullmq", "ioredis"],
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "42mb",
    },
  },
  async headers() {
    const production = process.env.NODE_ENV === "production";
    const headers = [
      {
        key: "Content-Security-Policy",
        value: createContentSecurityPolicy(process.env.NODE_ENV),
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "DENY" },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
