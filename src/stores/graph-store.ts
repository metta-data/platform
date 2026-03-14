import { create } from "zustand";
import type { ReferenceGraphResponse, GraphViewMode } from "@/types";

export type GraphDepth = 1 | 2 | 3 | "all";
export type GraphDirection = "all" | "inbound" | "outbound";

interface GraphState {
  // Data
  snapshotId: string | null;
  graphData: ReferenceGraphResponse | null;
  loading: boolean;
  error: string | null;

  // View controls
  viewMode: GraphViewMode;
  showOrphans: boolean;
  showLabels: boolean;
  showHierarchy: boolean;
  searchQuery: string;
  hiddenScopes: Set<string>;

  // Focus / depth
  focusTable: string | null;
  depth: GraphDepth;
  direction: GraphDirection;

  // Interaction
  hoveredNode: string | null;
  selectedNode: string | null;
  selectedEdge: string | null;

  // Force simulation controls
  linkDistance: number;
  chargeStrength: number;

  // Actions
  setSnapshotId: (id: string | null) => void;
  setGraphData: (data: ReferenceGraphResponse | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setViewMode: (mode: GraphViewMode) => void;
  setShowOrphans: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowHierarchy: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setHiddenScopes: (scopes: Set<string>) => void;
  toggleScope: (scopeKey: string) => void;
  setFocusTable: (name: string | null) => void;
  setDepth: (depth: GraphDepth) => void;
  setDirection: (direction: GraphDirection) => void;
  setHoveredNode: (name: string | null) => void;
  setSelectedNode: (name: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  setLinkDistance: (distance: number) => void;
  setChargeStrength: (strength: number) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  snapshotId: null,
  graphData: null,
  loading: false,
  error: null,

  viewMode: "tables",
  showOrphans: false,
  showLabels: false,
  showHierarchy: false,
  searchQuery: "",
  hiddenScopes: new Set<string>(),

  focusTable: null,
  depth: 2,
  direction: "all" as GraphDirection,

  hoveredNode: null,
  selectedNode: null,
  selectedEdge: null,

  linkDistance: 150,
  chargeStrength: -300,

  setSnapshotId: (id) => set({ snapshotId: id, graphData: null, error: null }),
  setGraphData: (data) => set({ graphData: data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowOrphans: (show) => set({ showOrphans: show }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowHierarchy: (show) => set({ showHierarchy: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setHiddenScopes: (scopes) => set({ hiddenScopes: scopes }),
  toggleScope: (scopeKey) =>
    set((state) => {
      const next = new Set(state.hiddenScopes);
      if (next.has(scopeKey)) {
        next.delete(scopeKey);
      } else {
        next.add(scopeKey);
      }
      return { hiddenScopes: next };
    }),
  setFocusTable: (name) => set({ focusTable: name, selectedNode: null }),
  setDepth: (depth) => set({ depth }),
  setDirection: (direction) => set({ direction }),
  setHoveredNode: (name) => set({ hoveredNode: name }),
  setSelectedNode: (name) => set({ selectedNode: name, selectedEdge: null }),
  setSelectedEdge: (id) => set({ selectedEdge: id, selectedNode: null }),
  setLinkDistance: (distance) => set({ linkDistance: distance }),
  setChargeStrength: (strength) => set({ chargeStrength: strength }),
}));
