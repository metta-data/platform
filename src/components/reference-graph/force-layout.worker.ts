import { computeForceLayout } from "./force-layout";
import type { ForceLayoutOptions } from "./force-layout";
import type { ReferenceGraphNode, ReferenceGraphEdge } from "@/types";

interface ForceLayoutRequest {
  type: "compute";
  id: number;
  nodes: ReferenceGraphNode[];
  edges: ReferenceGraphEdge[];
  options: ForceLayoutOptions;
}

self.onmessage = (event: MessageEvent<ForceLayoutRequest>) => {
  const { type, id, nodes, edges, options } = event.data;
  if (type !== "compute") return;

  const result = computeForceLayout(nodes, edges, options);

  self.postMessage({
    type: "result",
    id,
    nodes: result.nodes,
    edges: result.edges,
  });
};
