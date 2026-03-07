import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";

let commitHash =
  // Railway provides the full SHA at build time
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Not in a git repo (e.g., Railway build without .git) — keep Railway SHA or "dev"
}

// Read version from package.json at build time
const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
const appVersion = packageJson.version || "0.0.0";

const authEnabled =
  process.env.AUTH_SECRET &&
  process.env.AUTH_GITHUB_ID &&
  process.env.AUTH_GITHUB_SECRET
    ? "true"
    : "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_AUTH_ENABLED: authEnabled,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
