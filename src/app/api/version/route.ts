import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const changelogPath = join(process.cwd(), "CHANGELOG.md");
    const content = readFileSync(changelogPath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new NextResponse("# Changelog\n\nNo changelog available.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
