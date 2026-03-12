import { describe, it, expect, vi } from "vitest";
import {
  mockPrisma,
  mockUnauthorized,
  mockStewardSession,
} from "../setup";

// Mock syncAutoTags — it's a side-effect we don't want to test here
vi.mock("@/lib/catalog/auto-tags", () => ({
  syncAutoTags: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are in place
const { GET, PATCH } = await import(
  "@/app/api/catalog/[tableName]/[element]/route"
);

// ---------------------------------------------------------------------------
// Helper to build a mock Next.js params promise
// ---------------------------------------------------------------------------
function mockParams(tableName: string, element: string) {
  return { params: Promise.resolve({ tableName, element }) };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const baseCatalogEntry = {
  id: "entry-1",
  tableName: "cmdb_ci",
  element: "name",
  label: "Name",
  internalType: "string",
  definition: "The display name of the CI",
  definitionSource: "MANUAL",
  definitionSourceDetail: null,
  citationUrl: null,
  validationStatus: "DRAFT",
  validatedAt: null,
  validatedBy: null,
  validatedById: null,
  steward: null,
  stewardId: null,
  isDeprecated: false,
  deprecatedAt: null,
  deprecatedById: null,
  deprecatedBy: null,
  deprecationNote: null,
  supersededById: null,
  supersededBy: null,
  supersedes: [],
  sourceSnapshot: null,
  snapshots: [],
  tags: [],
  classifications: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// GET /api/catalog/[tableName]/[element]
// ---------------------------------------------------------------------------
describe("GET /api/catalog/[tableName]/[element]", () => {
  it("returns 404 when entry does not exist", async () => {
    mockPrisma.catalogEntry.findUnique.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), mockParams("cmdb_ci", "name"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Catalog entry not found");
  });

  it("returns the catalog entry with audit history", async () => {
    mockPrisma.catalogEntry.findUnique.mockResolvedValue(baseCatalogEntry);
    mockPrisma.catalogFieldAudit.findMany.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost"), mockParams("cmdb_ci", "name"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.entry.tableName).toBe("cmdb_ci");
    expect(data.entry.element).toBe("name");
    expect(data.auditHistory).toEqual([]);
  });

  it("decodes URL-encoded table and element names", async () => {
    mockPrisma.catalogEntry.findUnique.mockResolvedValue(null);

    await GET(new Request("http://localhost"), mockParams("cmdb%5Fci", "host%5Fname"));

    expect(mockPrisma.catalogEntry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tableName_element: {
            tableName: "cmdb_ci",
            element: "host_name",
          },
        },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/catalog/[tableName]/[element]
// ---------------------------------------------------------------------------
describe("PATCH /api/catalog/[tableName]/[element]", () => {
  it("returns 401 without steward/admin role", async () => {
    mockUnauthorized();

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ definition: "New definition" }),
    });

    const response = await PATCH(request, mockParams("cmdb_ci", "name"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when entry does not exist", async () => {
    mockPrisma.catalogEntry.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ definition: "New definition" }),
    });

    const response = await PATCH(request, mockParams("cmdb_ci", "nonexistent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Catalog entry not found");
  });

  it("updates definition and creates audit record", async () => {
    mockStewardSession();

    mockPrisma.catalogEntry.findUnique.mockResolvedValue(baseCatalogEntry);
    mockPrisma.catalogEntry.update.mockResolvedValue({
      ...baseCatalogEntry,
      definition: "Updated definition",
      tags: [],
    });
    mockPrisma.catalogFieldAudit.create.mockResolvedValue({});

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ definition: "Updated definition" }),
    });

    const response = await PATCH(request, mockParams("cmdb_ci", "name"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.definition).toBe("Updated definition");

    // Verify audit was created
    expect(mockPrisma.catalogFieldAudit.create).toHaveBeenCalled();
  });

  it("resets validation status to DRAFT when definition changes", async () => {
    mockStewardSession();

    mockPrisma.catalogEntry.findUnique.mockResolvedValue({
      ...baseCatalogEntry,
      validationStatus: "VALIDATED",
    });
    mockPrisma.catalogEntry.update.mockResolvedValue({
      ...baseCatalogEntry,
      definition: "New def",
      validationStatus: "DRAFT",
      tags: [],
    });

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ definition: "New def" }),
    });

    const response = await PATCH(request, mockParams("cmdb_ci", "name"));
    expect(response.status).toBe(200);

    // Check the update call included DRAFT reset
    const updateCall = mockPrisma.catalogEntry.update.mock.calls[0][0];
    expect(updateCall.data.validationStatus).toBe("DRAFT");
    expect(updateCall.data.validatedAt).toBeNull();
  });
});
