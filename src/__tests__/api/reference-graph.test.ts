import { describe, it, expect } from "vitest";
import { mockPrisma } from "../setup";

const { GET } = await import("@/app/api/reference-graph/route");

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/reference-graph");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// ---------------------------------------------------------------------------
// GET /api/reference-graph
// ---------------------------------------------------------------------------
describe("GET /api/reference-graph", () => {
  it("returns 400 when snapshotId is missing", async () => {
    const response = await GET(makeRequest({}));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/snapshotId/i);
  });

  it("returns 404 when snapshot has no tables", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([]);
    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    expect(response.status).toBe(404);
  });

  it("returns empty graph when no reference columns exist", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([
      { name: "incident", label: "Incident", scopeName: "global", scopeLabel: "Global", totalColumnCount: 50, superClassName: null },
      { name: "sys_user", label: "User", scopeName: "global", scopeLabel: "Global", totalColumnCount: 30, superClassName: null },
    ]);
    mockPrisma.snapshotColumn.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toHaveLength(2);
    expect(data.edges).toHaveLength(0);
    expect(data.stats.totalTables).toBe(2);
    expect(data.stats.totalReferences).toBe(0);
    expect(data.stats.orphanCount).toBe(2);
    expect(data.nodes.every((n: { isOrphan: boolean }) => n.isOrphan)).toBe(true);
  });

  it("computes nodes, edges, and degree for a 3-table scenario", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([
      { name: "incident", label: "Incident", scopeName: "global", scopeLabel: "Global", totalColumnCount: 50, superClassName: null },
      { name: "sys_user", label: "User", scopeName: "global", scopeLabel: "Global", totalColumnCount: 30, superClassName: null },
      { name: "cmdb_ci", label: "Configuration Item", scopeName: "global", scopeLabel: "Global", totalColumnCount: 40, superClassName: null },
    ]);

    // incident -> sys_user (caller_id, assigned_to)
    // incident -> cmdb_ci (cmdb_ci)
    mockPrisma.snapshotColumn.findMany.mockResolvedValue([
      { element: "caller_id", label: "Caller", referenceTable: "sys_user", definedOnTable: "incident", table: { name: "incident" } },
      { element: "assigned_to", label: "Assigned to", referenceTable: "sys_user", definedOnTable: "incident", table: { name: "incident" } },
      { element: "cmdb_ci", label: "Configuration item", referenceTable: "cmdb_ci", definedOnTable: "incident", table: { name: "incident" } },
    ]);

    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toHaveLength(3);
    expect(data.edges).toHaveLength(2); // incident->sys_user, incident->cmdb_ci

    // Check incident node: 3 outbound (2 to sys_user + 1 to cmdb_ci)
    const incidentNode = data.nodes.find((n: { name: string }) => n.name === "incident");
    expect(incidentNode.outboundReferenceCount).toBe(3);
    expect(incidentNode.inboundReferenceCount).toBe(0);
    expect(incidentNode.degree).toBe(3);
    expect(incidentNode.isOrphan).toBe(false);

    // Check sys_user node: 2 inbound from incident
    const userNode = data.nodes.find((n: { name: string }) => n.name === "sys_user");
    expect(userNode.inboundReferenceCount).toBe(2);
    expect(userNode.outboundReferenceCount).toBe(0);
    expect(userNode.degree).toBe(2);

    // Check cmdb_ci: 1 inbound
    const ciNode = data.nodes.find((n: { name: string }) => n.name === "cmdb_ci");
    expect(ciNode.inboundReferenceCount).toBe(1);
    expect(ciNode.degree).toBe(1);

    // Edge from incident -> sys_user should have 2 fields and type "reference"
    const userEdge = data.edges.find((e: { target: string }) => e.target === "sys_user");
    expect(userEdge.fields).toHaveLength(2);
    expect(userEdge.weight).toBe(2);
    expect(userEdge.type).toBe("reference");
  });

  it("resolves reference labels to table names", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([
      { name: "incident", label: "Incident", scopeName: null, scopeLabel: null, totalColumnCount: 50, superClassName: null },
      { name: "sys_user", label: "User", scopeName: null, scopeLabel: null, totalColumnCount: 30, superClassName: null },
    ]);

    // referenceTable stored as "User" (label) instead of "sys_user" (name)
    mockPrisma.snapshotColumn.findMany.mockResolvedValue([
      { element: "caller_id", label: "Caller", referenceTable: "User", definedOnTable: "incident", table: { name: "incident" } },
    ]);

    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    const data = await response.json();

    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].source).toBe("incident");
    expect(data.edges[0].target).toBe("sys_user");
    expect(data.edges[0].type).toBe("reference");
  });

  it("skips self-references", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([
      { name: "incident", label: "Incident", scopeName: null, scopeLabel: null, totalColumnCount: 50, superClassName: null },
    ]);

    // incident references itself
    mockPrisma.snapshotColumn.findMany.mockResolvedValue([
      { element: "parent", label: "Parent", referenceTable: "incident", definedOnTable: "incident", table: { name: "incident" } },
    ]);

    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    const data = await response.json();

    expect(data.edges).toHaveLength(0);
    expect(data.nodes[0].isOrphan).toBe(true);
  });

  it("identifies orphan nodes correctly", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([
      { name: "incident", label: "Incident", scopeName: null, scopeLabel: null, totalColumnCount: 50, superClassName: null },
      { name: "sys_user", label: "User", scopeName: null, scopeLabel: null, totalColumnCount: 30, superClassName: null },
      { name: "orphan_table", label: "Orphan", scopeName: null, scopeLabel: null, totalColumnCount: 5, superClassName: null },
    ]);

    mockPrisma.snapshotColumn.findMany.mockResolvedValue([
      { element: "caller_id", label: "Caller", referenceTable: "sys_user", definedOnTable: "incident", table: { name: "incident" } },
    ]);

    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    const data = await response.json();

    const orphan = data.nodes.find((n: { name: string }) => n.name === "orphan_table");
    expect(orphan.isOrphan).toBe(true);
    expect(orphan.degree).toBe(0);

    expect(data.stats.orphanCount).toBe(1);
  });

  it("generates hierarchy edges from superClassName", async () => {
    mockPrisma.snapshotTable.findMany.mockResolvedValue([
      { name: "task", label: "Task", scopeName: "global", scopeLabel: "Global", totalColumnCount: 80, superClassName: null },
      { name: "incident", label: "Incident", scopeName: "global", scopeLabel: "Global", totalColumnCount: 50, superClassName: "task" },
      { name: "change_request", label: "Change Request", scopeName: "global", scopeLabel: "Global", totalColumnCount: 60, superClassName: "task" },
    ]);
    mockPrisma.snapshotColumn.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest({ snapshotId: "snap-1" }));
    const data = await response.json();

    expect(response.status).toBe(200);

    // Two hierarchy edges: incident→task and change_request→task
    const hierEdges = data.edges.filter((e: { type: string }) => e.type === "hierarchy");
    expect(hierEdges).toHaveLength(2);
    expect(hierEdges[0].fields).toHaveLength(0); // no fields for hierarchy

    // incident extends task
    const incidentEdge = hierEdges.find((e: { source: string }) => e.source === "incident");
    expect(incidentEdge.target).toBe("task");
    expect(incidentEdge.type).toBe("hierarchy");

    // task has 2 inbound hierarchy connections
    const taskNode = data.nodes.find((n: { name: string }) => n.name === "task");
    expect(taskNode.inboundReferenceCount).toBe(2);
    expect(taskNode.isOrphan).toBe(false);

    // incident has 1 outbound hierarchy connection
    const incidentNode = data.nodes.find((n: { name: string }) => n.name === "incident");
    expect(incidentNode.outboundReferenceCount).toBe(1);

    // superClassName is included on nodes
    expect(incidentNode.superClassName).toBe("task");
    expect(taskNode.superClassName).toBeNull();
  });
});
