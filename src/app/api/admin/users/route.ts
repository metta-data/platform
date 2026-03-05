import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clean up stale pending accounts (older than 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await prisma.user.deleteMany({
    where: {
      role: "PENDING",
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      githubId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      approvedBy: {
        select: { username: true, displayName: true },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(users);
}
