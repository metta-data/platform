import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const instances = await prisma.serviceNowInstance.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      url: true,
      username: true,
      isActive: true,
      createdAt: true,
      _count: { select: { snapshots: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(instances);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, url, username, password } = body;

  if (!name || !url || !username || !password) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  const instance = await prisma.serviceNowInstance.create({
    data: {
      name,
      url: url.replace(/\/$/, ""),
      username,
      encryptedPassword: password, // TODO: encrypt
    },
  });

  return NextResponse.json(instance, { status: 201 });
}
