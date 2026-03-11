import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApproved, requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await requireApproved();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;
  const userRole =
    typeof session === "object" && "user" in session
      ? session.user?.role
      : undefined;

  const comment = await prisma.catalogComment.findUnique({
    where: { id: commentId },
  });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only author or admin can edit
  if (comment.authorId !== userId && userRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { body: newBody } = body;

  if (!newBody?.trim()) {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    );
  }

  const updated = await prisma.catalogComment.update({
    where: { id: commentId },
    data: { body: newBody.trim() },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await requireApproved();
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

  // Only author or admin can delete
  const adminSession = await requireAdmin();
  if (comment.authorId !== userId && !adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.catalogComment.delete({ where: { id: commentId } });
  return NextResponse.json({ success: true });
}
