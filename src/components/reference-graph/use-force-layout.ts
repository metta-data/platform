import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { ReferenceGraphNode, ReferenceGraphEdge } from "@/types";
import type { LayoutNode, LayoutEdge } from "./types";
import type { ForceLayoutOptions } from "./force-layout";

interface UseForceLayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  computing: boolean;
}

const emptyNodes: LayoutNode[] = [];
const emptyEdges: LayoutEdge[] = [];

export function useForceLayout(
  graphNodes: ReferenceGraphNode[] | null,
  graphEdges: ReferenceGraphEdge[] | null,
  options: ForceLayoutOptions
): UseForceLayoutResult {
  const [workerResult, setWorkerResult] = useState<{
    nodes: LayoutNode[];
    edges: LayoutEdge[];
    requestId: number;
  } | null>(null);
  // Track dispatched request ID as state so it's available during render
  const [dispatchedId, setDispatchedId] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);

  const hasInput = !!graphNodes && graphNodes.length > 0 && !!graphEdges;

  // Stable callback for worker messages
  const handleMessage = useCallback((event: MessageEvent) => {
    const { type, id, nodes, edges } = event.data;
    if (type === "result") {
      setWorkerResult({ nodes, edges, requestId: id });
    }
  }, []);

  // Initialize worker on mount, terminate on unmount
  useEffect(() => {
    const worker = new Worker(
      new URL("./force-layout.worker.ts", import.meta.url)
    );
    workerRef.current = worker;
    worker.onmessage = handleMessage;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [handleMessage]);

  // Post computation requests when inputs change
  useEffect(() => {
    const id = ++nextIdRef.current;
    setDispatchedId(id);

    if (!hasInput) return;

    workerRef.current?.postMessage({
      type: "compute",
      id,
      nodes: graphNodes,
      edges: graphEdges,
      options,
    });
  }, [graphNodes, graphEdges, options, hasInput]);

  // Derive final result
  const nodes = useMemo(
    () => (hasInput && workerResult ? workerResult.nodes : emptyNodes),
    [hasInput, workerResult]
  );
  const edges = useMemo(
    () => (hasInput && workerResult ? workerResult.edges : emptyEdges),
    [hasInput, workerResult]
  );

  // Computing = we have input and the latest result doesn't match the dispatched request
  const computing = hasInput && (!workerResult || workerResult.requestId !== dispatchedId);

  return { nodes, edges, computing };
}
