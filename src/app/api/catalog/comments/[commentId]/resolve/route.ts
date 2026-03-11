import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;

  const comment = await prisma.catalogComment.findUnique({
    where: { id: commentId },
  });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only top-level comments can be resolved
  if (comment.parentId) {
    return NextResponse.json(
      { error: "Only top-level comments can be resolved" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { resolved } = body;

  const updated = await prisma.catalogComment.update({
    where: { id: commentId },
    data: {
      isResolved: resolved,
      resolvedById: resolved ? userId || null : null,
      resolvedAt: resolved ? new Date() : null,
    },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      resolvedBy: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  return NextResponse.json(updated);
}
