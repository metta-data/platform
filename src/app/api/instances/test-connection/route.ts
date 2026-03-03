import { NextResponse } from "next/server";
import { ServiceNowClient } from "@/lib/servicenow/client";

export async function POST(request: Request) {
  const body = await request.json();
  const { url, username, password } = body;

  if (!url || !username || !password) {
    return NextResponse.json(
      { error: "URL, username, and password are required" },
      { status: 400 }
    );
  }

  try {
    const client = new ServiceNowClient({ url, username, password });
    const result = await client.testConnection();
    return NextResponse.json({
      success: true,
      message: `Connected successfully. Found ${result.tableCount.toLocaleString()} tables.`,
      tableCount: result.tableCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }
}
