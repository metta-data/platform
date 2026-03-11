import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApproved } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableName: string; element: string }> }
) {
  const { tableName, element } = await params;
  const decodedTable = decodeURIComponent(tableName);
  const decodedElement = decodeURIComponent(element);

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
    select: { id: true },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  const comments = await prisma.catalogComment.findMany({
    where: { catalogEntryId: entry.id, parentId: null },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      resolvedBy: {
        select: { id: true, username: true, displayName: true },
      },
      replies: {
        include: {
          author: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableName: string; element: string }> }
) {
  const session = await requireApproved();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableName, element } = await params;
  const decodedTable = decodeURIComponent(tableName);
  const decodedElement = decodeURIComponent(element);

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
    select: { id: true },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json();
  const { body: commentBody, parentId } = body;

  if (!commentBody?.trim()) {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    );
  }

  // Validate parentId is a top-level comment (no nesting beyond 1 level)
  if (parentId) {
    const parent = await prisma.catalogComment.findUnique({
      where: { id: parentId },
      select: { parentId: true, catalogEntryId: true },
    });
    if (!parent || parent.catalogEntryId !== entry.id) {
      return NextResponse.json(
        { error: "Invalid parent comment" },
        { status: 400 }
      );
    }
    if (parent.parentId) {
      return NextResponse.json(
        { error: "Replies can only be one level deep" },
        { status: 400 }
      );
    }
  }

  const comment = await prisma.catalogComment.create({
    data: {
      catalogEntryId: entry.id,
      authorId: userId,
      body: commentBody.trim(),
      parentId: parentId || null,
    },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
