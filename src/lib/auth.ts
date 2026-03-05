// Auth.js auto-detects RAILWAY_PUBLIC_DOMAIN but without protocol, causing
// "Invalid URL" errors. Set AUTH_URL with protocol before importing next-auth.
if (process.env.RAILWAY_PUBLIC_DOMAIN && !process.env.AUTH_URL) {
  process.env.AUTH_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
}

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// NOTE: prisma is imported dynamically inside callbacks to avoid bundling
// Node.js-only Prisma client into the Edge Runtime middleware bundle.

const authEnabled = !!(
  process.env.AUTH_SECRET &&
  process.env.AUTH_GITHUB_ID &&
  process.env.AUTH_GITHUB_SECRET
);

async function getPrisma() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

const result = authEnabled
  ? NextAuth({
      providers: [GitHub],
      session: { strategy: "jwt" },
      callbacks: {
        async signIn({ profile }) {
          if (!profile?.id) return false;

          const prisma = await getPrisma();
          const githubId = String(profile.id);
          const ghProfile = profile as Record<string, unknown>;
          const isBootstrapAdmin =
            githubId === process.env.ADMIN_GITHUB_ID;

          await prisma.user.upsert({
            where: { githubId },
            update: {
              username:
                (ghProfile.login as string) || profile.name || "unknown",
              displayName: profile.name || null,
              avatarUrl:
                (ghProfile.avatar_url as string) ||
                (profile.image as string) ||
                null,
            },
            create: {
              githubId,
              username:
                (ghProfile.login as string) || profile.name || "unknown",
              displayName: profile.name || null,
              avatarUrl:
                (ghProfile.avatar_url as string) ||
                (profile.image as string) ||
                null,
              role: isBootstrapAdmin ? "ADMIN" : "PENDING",
            },
          });

          return true;
        },

        async jwt({ token, profile, trigger }) {
          // On sign-in, read role from DB (runs in Node.js runtime)
          if (profile) {
            token.githubId = String(profile.id);
            try {
              const prisma = await getPrisma();
              const user = await prisma.user.findUnique({
                where: { githubId: String(profile.id) },
                select: { id: true, role: true },
              });
              token.userId = user?.id;
              token.role = user?.role || "PENDING";
            } catch {
              // DB not available (e.g., Edge Runtime) — keep existing token data
            }
          }

          // On manual session update, refresh role from DB
          if (trigger === "update" && token.githubId) {
            try {
              const prisma = await getPrisma();
              const user = await prisma.user.findUnique({
                where: { githubId: token.githubId as string },
                select: { id: true, role: true },
              });
              token.userId = user?.id;
              token.role = user?.role || "PENDING";
            } catch {
              // DB not available — keep existing token data
            }
          }

          return token;
        },

        session({ session, token }) {
          if (token.githubId) {
            session.user.githubId = token.githubId as string;
            session.user.userId = token.userId as string;
            session.user.role = token.role as string;
            session.user.isAdmin = token.role === "ADMIN";
          }
          return session;
        },
      },
    })
  : null;

export const handlers = result?.handlers ?? {
  GET: () => new Response("Auth not configured", { status: 503 }),
  POST: () => new Response("Auth not configured", { status: 503 }),
};
export const auth = result?.auth ?? (() => Promise.resolve(null));
export const signIn = result?.signIn ?? (() => Promise.resolve());
export const signOut = result?.signOut ?? (() => Promise.resolve());
export { authEnabled };

/** Call in admin API route handlers for defense-in-depth.
 *  When auth is not configured, allows all requests through. */
export async function requireAdmin() {
  if (!authEnabled) return true;
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

/** Require an approved user (VIEWER, STEWARD, or ADMIN).
 *  When auth is not configured, allows all requests through. */
export async function requireApproved() {
  if (!authEnabled) return true;
  const session = await auth();
  if (!session?.user?.role || session.user.role === "PENDING") return null;
  return session;
}

/** Require a steward or admin (STEWARD or ADMIN).
 *  When auth is not configured, allows all requests through. */
export async function requireStewardOrAdmin() {
  if (!authEnabled) return true;
  const session = await auth();
  if (!session?.user?.role) return null;
  if (!["STEWARD", "ADMIN"].includes(session.user.role)) return null;
  return session;
}
