import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAndIngestJson, parseCsvUpload } from "@/lib/upload/parser";
import { requireApproved } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await requireApproved())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = formData.get("label") as string | null;
  const format = formData.get("format") as string | null;
  const tablesFile = formData.get("tablesFile") as File | null;

  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  try {
    // Create the snapshot
    const snapshot = await prisma.schemaSnapshot.create({
      data: {
        label,
        sourceType: format === "csv" ? "UPLOAD_CSV" : "UPLOAD_JSON",
        isBaseline: false,
        ingestStartedAt: new Date(),
      },
    });

    if (format === "csv") {
      if (!file || !tablesFile) {
        return NextResponse.json(
          { error: "Both tables CSV and columns CSV are required" },
          { status: 400 }
        );
      }
      const tablesCsv = await tablesFile.text();
      const columnsCsv = await file.text();
      const result = await parseCsvUpload(snapshot.id, tablesCsv, columnsCsv);
      return NextResponse.json({ snapshotId: snapshot.id, ...result });
    } else {
      if (!file) {
        return NextResponse.json(
          { error: "JSON file is required" },
          { status: 400 }
        );
      }
      const text = await file.text();
      const jsonData = JSON.parse(text);
      const result = await parseAndIngestJson(snapshot.id, jsonData);
      return NextResponse.json({ snapshotId: snapshot.id, ...result });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
