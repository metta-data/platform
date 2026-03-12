/**
 * Global test setup — mocks for Prisma, auth, and external services.
 *
 * Mocking strategy:
 *  - Prisma: vi.mock("@/lib/db") — each test sets return values via mockPrisma
 *  - Auth: vi.mock("@/lib/auth") — toggle roles per test via mockAuth helpers
 *  - External APIs are mocked per-test as needed
 */
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
// Create a deeply-mocked Prisma client. Each model method (findMany, create, etc.)
// is a vi.fn() that tests can configure with mockResolvedValue / mockReturnValue.

function createMockModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({}),
    groupBy: vi.fn().mockResolvedValue([]),
  };
}

export const mockPrisma = {
  schemaSnapshot: createMockModel(),
  snapshotTable: createMockModel(),
  snapshotColumn: createMockModel(),
  serviceNowInstance: createMockModel(),
  catalogEntry: createMockModel(),
  catalogFieldAudit: createMockModel(),
  user: createMockModel(),
  aiModelConfig: createMockModel(),
  tag: createMockModel(),
  classificationLevel: createMockModel(),
  glossaryTerm: createMockModel(),
  catalogComment: createMockModel(),
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
    fn(mockPrisma)
  ),
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------
// Default: auth disabled (all routes pass through). Tests can override per-test.

const mockSession = {
  user: {
    githubId: "12345",
    userId: "user-1",
    role: "ADMIN",
    isAdmin: true,
    name: "Test User",
    email: "test@example.com",
    image: "https://example.com/avatar.png",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

export const mockRequireAdmin = vi.fn().mockResolvedValue(mockSession);
export const mockRequireApproved = vi.fn().mockResolvedValue(mockSession);
export const mockRequireStewardOrAdmin = vi.fn().mockResolvedValue(mockSession);

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requireApproved: (...args: unknown[]) => mockRequireApproved(...args),
  requireStewardOrAdmin: (...args: unknown[]) =>
    mockRequireStewardOrAdmin(...args),
  auth: vi.fn().mockResolvedValue(mockSession),
  authEnabled: true,
}));

// ---------------------------------------------------------------------------
// Auth helper utilities for tests
// ---------------------------------------------------------------------------

/** Simulate an unauthenticated / unauthorized request */
export function mockUnauthorized() {
  mockRequireAdmin.mockResolvedValue(null);
  mockRequireApproved.mockResolvedValue(null);
  mockRequireStewardOrAdmin.mockResolvedValue(null);
}

/** Simulate an admin session (default) */
export function mockAdminSession() {
  mockRequireAdmin.mockResolvedValue(mockSession);
  mockRequireApproved.mockResolvedValue(mockSession);
  mockRequireStewardOrAdmin.mockResolvedValue(mockSession);
}

/** Simulate a steward session */
export function mockStewardSession() {
  const stewardSession = {
    ...mockSession,
    user: { ...mockSession.user, role: "STEWARD", isAdmin: false },
  };
  mockRequireAdmin.mockResolvedValue(null);
  mockRequireApproved.mockResolvedValue(stewardSession);
  mockRequireStewardOrAdmin.mockResolvedValue(stewardSession);
}

/** Simulate a viewer session */
export function mockViewerSession() {
  const viewerSession = {
    ...mockSession,
    user: { ...mockSession.user, role: "VIEWER", isAdmin: false },
  };
  mockRequireAdmin.mockResolvedValue(null);
  mockRequireApproved.mockResolvedValue(viewerSession);
  mockRequireStewardOrAdmin.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------
import { beforeEach } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default admin session
  mockAdminSession();
});
