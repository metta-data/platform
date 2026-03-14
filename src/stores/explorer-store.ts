import { create } from "zustand";
import type { SnapshotSummary, SelectedField } from "@/types";

interface ExplorerState {
  selectedSnapshotId: string | null;
  availableSnapshots: SnapshotSummary[];
  searchQuery: string;
  scopeFilter: string | null;
  selectedTable: string | null;
  viewMode: "detail" | "map" | "graph";
  highlightedColumn: string | null;

  // Query builder state
  queryBuilderFields: SelectedField[];
  queryBuilderInstance: string;
  queryBuilderSnowflakeLocator: string;

  // Display column cache: referenced table name → display column element (or null if none)
  displayColumnCache: Record<string, string | null>;

  setSnapshot: (id: string) => void;
  setAvailableSnapshots: (snapshots: SnapshotSummary[]) => void;
  setSearchQuery: (query: string) => void;
  setScopeFilter: (scope: string | null) => void;
  setSelectedTable: (name: string | null) => void;
  setViewMode: (mode: "detail" | "map" | "graph") => void;
  setHighlightedColumn: (column: string | null) => void;

  // Query builder actions
  toggleField: (field: {
    element: string;
    label: string;
    definedOnTable: string;
    internalType: string;
    referenceTable: string | null;
  }) => void;
  toggleDotWalkField: (
    parentElement: string,
    child: { element: string; label: string }
  ) => void;
  removeField: (element: string) => void;
  removeDotWalkField: (parentElement: string, childElement: string) => void;
  clearQueryBuilderFields: () => void;
  setQueryBuilderInstance: (instance: string) => void;
  setQueryBuilderSnowflakeLocator: (locator: string) => void;
  fetchDisplayColumns: (snapshotId: string, tableNames: string[]) => Promise<void>;
}

// Load persisted values from localStorage
function getPersistedInstance(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("queryBuilderInstance") || "";
  } catch {
    return "";
  }
}

function getPersistedSnowflakeLocator(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("queryBuilderSnowflakeLocator") || "";
  } catch {
    return "";
  }
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  selectedSnapshotId: null,
  availableSnapshots: [],
  searchQuery: "",
  scopeFilter: null,
  selectedTable: null,
  viewMode: "detail",
  highlightedColumn: null,

  // Query builder
  queryBuilderFields: [],
  queryBuilderInstance: getPersistedInstance(),
  queryBuilderSnowflakeLocator: getPersistedSnowflakeLocator(),
  displayColumnCache: {},

  setSnapshot: (id) =>
    set({ selectedSnapshotId: id, selectedTable: null, queryBuilderFields: [], displayColumnCache: {} }),
  setAvailableSnapshots: (snapshots) => {
    set((state) => ({
      availableSnapshots: snapshots,
      selectedSnapshotId: state.selectedSnapshotId || snapshots[0]?.id || null,
    }));
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setScopeFilter: (scope) => set({ scopeFilter: scope }),
  setSelectedTable: (name) => set({ selectedTable: name, queryBuilderFields: [], highlightedColumn: null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setHighlightedColumn: (column) => set({ highlightedColumn: column }),

  // Query builder actions
  toggleField: (field) =>
    set((state) => {
      const exists = state.queryBuilderFields.find(
        (f) => f.element === field.element
      );
      if (exists) {
        return {
          queryBuilderFields: state.queryBuilderFields.filter(
            (f) => f.element !== field.element
          ),
        };
      }
      return {
        queryBuilderFields: [
          ...state.queryBuilderFields,
          { ...field, dotWalkFields: [] },
        ],
      };
    }),

  toggleDotWalkField: (parentElement, child) =>
    set((state) => ({
      queryBuilderFields: state.queryBuilderFields.map((f) => {
        if (f.element !== parentElement) return f;
        const childExists = f.dotWalkFields.find(
          (dw) => dw.element === child.element
        );
        if (childExists) {
          return {
            ...f,
            dotWalkFields: f.dotWalkFields.filter(
              (dw) => dw.element !== child.element
            ),
          };
        }
        return {
          ...f,
          dotWalkFields: [...f.dotWalkFields, child],
        };
      }),
    })),

  removeField: (element) =>
    set((state) => ({
      queryBuilderFields: state.queryBuilderFields.filter(
        (f) => f.element !== element
      ),
    })),

  removeDotWalkField: (parentElement, childElement) =>
    set((state) => ({
      queryBuilderFields: state.queryBuilderFields.map((f) => {
        if (f.element !== parentElement) return f;
        return {
          ...f,
          dotWalkFields: f.dotWalkFields.filter(
            (dw) => dw.element !== childElement
          ),
        };
      }),
    })),

  clearQueryBuilderFields: () => set({ queryBuilderFields: [] }),

  setQueryBuilderInstance: (instance) => {
    try {
      localStorage.setItem("queryBuilderInstance", instance);
    } catch {
      // ignore
    }
    set({ queryBuilderInstance: instance });
  },

  setQueryBuilderSnowflakeLocator: (locator) => {
    try {
      localStorage.setItem("queryBuilderSnowflakeLocator", locator);
    } catch {
      // ignore
    }
    set({ queryBuilderSnowflakeLocator: locator });
  },

  fetchDisplayColumns: async (snapshotId, tableNames) => {
    // Filter to only uncached tables
    const cache = useExplorerStore.getState().displayColumnCache;
    const uncached = tableNames.filter((t) => !(t in cache));
    if (uncached.length === 0) return;

    try {
      const res = await fetch(
        `/api/tables/display-columns?snapshotId=${encodeURIComponent(snapshotId)}&tables=${encodeURIComponent(uncached.join(","))}`
      );
      if (!res.ok) return;
      const data: Record<string, string> = await res.json();

      // Merge results — tables not in response have no display column
      const merged: Record<string, string | null> = {};
      for (const t of uncached) {
        merged[t] = data[t] ?? null;
      }
      set((state) => ({
        displayColumnCache: { ...state.displayColumnCache, ...merged },
      }));
    } catch {
      // Silently fail — SQL will render without display columns
    }
  },
}));
