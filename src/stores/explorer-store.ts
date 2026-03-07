import { create } from "zustand";
import type { SnapshotSummary, SelectedField } from "@/types";

interface ExplorerState {
  selectedSnapshotId: string | null;
  availableSnapshots: SnapshotSummary[];
  searchQuery: string;
  scopeFilter: string | null;
  selectedTable: string | null;
  viewMode: "detail" | "map";

  // Query builder state
  queryBuilderFields: SelectedField[];
  queryBuilderInstance: string;

  setSnapshot: (id: string) => void;
  setAvailableSnapshots: (snapshots: SnapshotSummary[]) => void;
  setSearchQuery: (query: string) => void;
  setScopeFilter: (scope: string | null) => void;
  setSelectedTable: (name: string | null) => void;
  setViewMode: (mode: "detail" | "map") => void;

  // Query builder actions
  toggleField: (field: {
    element: string;
    label: string;
    definedOnTable: string;
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
}

// Load persisted instance from localStorage
function getPersistedInstance(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("queryBuilderInstance") || "";
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

  // Query builder
  queryBuilderFields: [],
  queryBuilderInstance: getPersistedInstance(),

  setSnapshot: (id) =>
    set({ selectedSnapshotId: id, selectedTable: null, queryBuilderFields: [] }),
  setAvailableSnapshots: (snapshots) => {
    set((state) => ({
      availableSnapshots: snapshots,
      selectedSnapshotId: state.selectedSnapshotId || snapshots[0]?.id || null,
    }));
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setScopeFilter: (scope) => set({ scopeFilter: scope }),
  setSelectedTable: (name) => set({ selectedTable: name, queryBuilderFields: [] }),
  setViewMode: (mode) => set({ viewMode: mode }),

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
}));
