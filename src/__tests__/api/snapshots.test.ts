import { describe, it, expect } from "vitest";
import { mockPrisma, mockUnauthorized } from "../setup";

const { GET, POST } = await import("@/app/api/snapshots/route");

// ---------------------------------------------------------------------------
// GET /api/snapshots
// ---------------------------------------------------------------------------
describe("GET /api/snapshots", () => {
  it("returns completed snapshots ordered by date", async () => {
    const snapshots = [
      {
        id: "snap-2",
        label: "March 2026",
        version: "2.0",
        description: null,
        status: "COMPLETED",
        tableCount: 2000,
        columnCount: 30000,
        isBaseline: false,
        createdAt: new Date("2026-03-01"),
      },
      {
        id: "snap-1",
        label: "February 2026",
        version: "1.0",
        description: null,
        status: "COMPLETED",
        tableCount: 1500,
        columnCount: 25000,
        isBaseline: true,
        createdAt: new Date("2026-02-01"),
      },
    ];

    mockPrisma.schemaSnapshot.findMany.mockResolvedValue(snapshots);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe("snap-2");
    expect(data[1].id).toBe("snap-1");
  });

  it("only queries COMPLETED snapshots", async () => {
    mockPrisma.schemaSnapshot.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.schemaSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "COMPLETED" },
      })
    );
  });

  it("returns empty array when no snapshots exist", async () => {
    mockPrisma.schemaSnapshot.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/snapshots
// ---------------------------------------------------------------------------
describe("POST /api/snapshots", () => {
  it("returns 401 without approved role", async () => {
    mockUnauthorized();

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ label: "New Snapshot" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when label is missing", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Label is required");
  });

  it("returns 400 when label is empty string", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ label: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("creates snapshot with required fields only", async () => {
    const created = {
      id: "snap-new",
      label: "New Snapshot",
      version: null,
      description: null,
      instanceId: null,
      isBaseline: false,
      status: "PENDING",
      createdAt: new Date(),
    };

    mockPrisma.schemaSnapshot.create.mockResolvedValue(created);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ label: "New Snapshot" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.label).toBe("New Snapshot");
    expect(data.isBaseline).toBe(false);
  });

  it("creates snapshot with all optional fields", async () => {
    const created = {
      id: "snap-full",
      label: "Full Snapshot",
      version: "1.0.0",
      description: "A fully specified snapshot",
      instanceId: "inst-1",
      isBaseline: true,
      status: "PENDING",
      createdAt: new Date(),
    };

    mockPrisma.schemaSnapshot.create.mockResolvedValue(created);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        label: "Full Snapshot",
        version: "1.0.0",
        description: "A fully specified snapshot",
        instanceId: "inst-1",
        isBaseline: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.isBaseline).toBe(true);
    expect(data.version).toBe("1.0.0");

    // Verify Prisma was called with correct data
    expect(mockPrisma.schemaSnapshot.create).toHaveBeenCalledWith({
      data: {
        label: "Full Snapshot",
        version: "1.0.0",
        description: "A fully specified snapshot",
        instanceId: "inst-1",
        isBaseline: true,
      },
    });
  });
});
