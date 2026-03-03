import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestFromInstance } from "@/lib/servicenow/ingest";

export async function POST(request: Request) {
  const body = await request.json();
  const { snapshotId, instanceId } = body;

  if (!snapshotId || !instanceId) {
    return NextResponse.json(
      { error: "snapshotId and instanceId are required" },
      { status: 400 }
    );
  }

  const instance = await prisma.serviceNowInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Instance not found" },
      { status: 404 }
    );
  }

  // Start ingestion in background (non-blocking)
  ingestFromInstance(snapshotId, {
    url: instance.url,
    username: instance.username,
    password: instance.encryptedPassword, // TODO: decrypt
  }).catch((err) => {
    console.error(
      `Ingestion failed for snapshot ${snapshotId} (instance: ${instance.name} / ${instance.url}):`,
      err instanceof Error ? err.message : err
    );
  });

  return NextResponse.json({ status: "started", snapshotId });
}
