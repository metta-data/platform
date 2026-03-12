import { describe, it, expect, vi } from "vitest";
import { mockUnauthorized } from "../setup";

// Mock ServiceNowClient — must use a class for `new` to work
const mockTestConnection = vi.fn();
vi.mock("@/lib/servicenow/client", () => ({
  ServiceNowClient: class MockServiceNowClient {
    testConnection = mockTestConnection;
  },
}));

const { POST } = await import(
  "@/app/api/instances/test-connection/route"
);

// ---------------------------------------------------------------------------
// POST /api/instances/test-connection
// ---------------------------------------------------------------------------
describe("POST /api/instances/test-connection", () => {
  it("returns 401 without admin role", async () => {
    mockUnauthorized();

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.service-now.com",
        username: "admin",
        password: "secret",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when required fields are missing", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns 400 when all fields are empty", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "", username: "", password: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns success on valid connection", async () => {
    mockTestConnection.mockResolvedValue({ tableCount: 1500 });

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.service-now.com",
        username: "admin",
        password: "secret",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tableCount).toBe(1500);
  });

  it("returns failure message on connection error (200 status)", async () => {
    mockTestConnection.mockRejectedValue(
      new Error("Authentication failed: invalid credentials")
    );

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.service-now.com",
        username: "admin",
        password: "wrong",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Note: this endpoint returns 200 even on failure, with success: false
    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Authentication failed");
  });
});
