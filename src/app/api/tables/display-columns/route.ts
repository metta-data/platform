import { NextResponse } from "next/server";
import { resolveDisplayColumns } from "@/lib/display-columns";

/**
 * GET /api/tables/display-columns?snapshotId=X&tables=sys_user,change_request,problem
 *
 * Returns a map of table name → display column element name.
 *
 * ServiceNow resolves the display value for reference fields in this order:
 *   1. display=true on the lowest sub-table (sys_dictionary)
 *   2. display=true on a parent table (inheritance chain)
 *   3. A field named name, u_name, or x_*_name
 *   4. A field named number, u_number, or x_*_number
 *   5. glide.record.display_value_default property (not available — skipped)
 *   6. sys_created_on
 *
 * We implement 1, 2, 3, 4, and 6 (skipping 5 since we don't ingest system properties).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  const tablesParam = searchParams.get("tables");

  if (!snapshotId || !tablesParam) {
    return NextResponse.json(
      { error: "snapshotId and tables are required" },
      { status: 400 }
    );
  }

  const tableNames = tablesParam.split(",").filter(Boolean);

  if (tableNames.length === 0) {
    return NextResponse.json({});
  }

  const result = await resolveDisplayColumns(snapshotId, tableNames);
  return NextResponse.json(result);
}
