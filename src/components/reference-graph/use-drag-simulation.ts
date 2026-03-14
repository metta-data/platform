"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { LayoutNode, LayoutEdge } from "./types";
import type { ForceNode, ForceLink, ForceLayoutOptions } from "./force-layout";
import { nodeRadius } from "./force-layout";

interface UseDragSimulationResult {
  /** Ref holding current positions — canvas reads this directly during draw */
  positionOverrides: React.RefObject<Map<string, { x: number; y: number }>>;
  /** Ref for the canvas to set a repaint callback (called on each simulation tick) */
  onTickRef: React.MutableRefObject<(() => void) | null>;
  /** Call when user starts dragging a node */
  onDragStart: (nodeId: string, x: number, y: number) => void;
  /** Call during drag with updated position */
  onDrag: (nodeId: string, x: number, y: number) => void;
  /** Call when drag ends */
  onDragStop: (nodeId: string) => void;
}

/**
 * Manages a main-thread d3-force simulation that activates during node drag.
 * The heavy initial layout stays in the Web Worker; this hook provides the
 * interactive "bounce" behavior when the user drags a node (Obsidian-style).
 *
 * Unlike the React Flow version, this does NOT trigger React re-renders.
 * Instead, it calls `onTickRef.current()` which the canvas uses to schedule
 * a repaint via requestAnimationFrame.
 */
export function useDragSimulation(
  workerNodes: LayoutNode[],
  workerEdges: LayoutEdge[],
  layoutOptions: ForceLayoutOptions
): UseDragSimulationResult {
  // Position override map: nodeId -> {x, y}
  // Seeded from worker output, mutated in-place by simulation ticks.
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());

  // d3-force simulation instance (main thread)
  const simRef = useRef<ReturnType<typeof forceSimulation<ForceNode>> | null>(null);

  // Simulation node array — d3 mutates these objects in place
  const simNodesRef = useRef<ForceNode[]>([]);

  // Fast lookup: nodeId -> ForceNode
  const simNodeMapRef = useRef(new Map<string, ForceNode>());

  // RAF handle for cleanup
  const rafRef = useRef<number | null>(null);

  // Track whether we're currently dragging
  const draggingRef = useRef<string | null>(null);

  // Callback the canvas sets to trigger repaint on each tick
  const onTickRef = useRef<(() => void) | null>(null);

  // ── Seed from worker output ──────────────────────────────────────────
  useEffect(() => {
    if (workerNodes.length === 0) return;

    // Cancel any running animation
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Seed position overrides from worker output
    const newPositions = new Map<string, { x: number; y: number }>();
    const newSimNodes: ForceNode[] = [];
    const newNodeMap = new Map<string, ForceNode>();

    for (const node of workerNodes) {
      const pos = { x: node.x, y: node.y };
      newPositions.set(node.id, pos);

      const forceNode: ForceNode = {
        id: node.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        label: node.label,
        degree: node.degree,
        radius: node.radius ?? nodeRadius(node.degree),
        data: node.data,
      };
      newSimNodes.push(forceNode);
      newNodeMap.set(node.id, forceNode);
    }

    positionsRef.current = newPositions;
    simNodesRef.current = newSimNodes;
    simNodeMapRef.current = newNodeMap;

    // Build simulation links from worker edges
    const simLinks: ForceLink[] = workerEdges
      .filter((e) => newNodeMap.has(e.source) && newNodeMap.has(e.target))
      .map((e) => ({
        id: e.id,
        source: newNodeMap.get(e.source)!,
        target: newNodeMap.get(e.target)!,
        type: e.type,
        weight: e.weight,
        fields: e.fields,
      }));

    // Create the simulation with same forces as the worker.
    // Uses containment forces (forceX/forceY) to keep the sphere shape.
    // Higher velocity decay = nodes feel anchored, gentle tug on neighbors.
    const sim = forceSimulation<ForceNode>(newSimNodes)
      .force(
        "link",
        forceLink<ForceNode, ForceLink>(simLinks)
          .id((d) => d.id)
          .distance(layoutOptions.linkDistance)
      )
      .force("charge", forceManyBody<ForceNode>().strength(layoutOptions.chargeStrength))
      .force(
        "collide",
        forceCollide<ForceNode>((d) => d.radius + 8)
      )
      // Containment forces — pull nodes back toward center to preserve the tight
      // sphere shape. Matches the initial layout strength (0.1) so dragging
      // doesn't deform the ball.
      .force("x", forceX<ForceNode>(0).strength(0.1))
      .force("y", forceY<ForceNode>(0).strength(0.1))
      .alphaDecay(0.1) // Fast cooling — settle quickly after drag
      .velocityDecay(0.6) // High friction — neighbors resist movement ("bungee" feel)
      .stop(); // Stays stopped until drag starts

    simRef.current = sim;
    draggingRef.current = null;

    // Notify canvas to repaint with new positions
    queueMicrotask(() => onTickRef.current?.());

    return () => {
      sim.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [workerNodes, workerEdges, layoutOptions]);

  // ── RAF tick loop ────────────────────────────────────────────────────
  const startTickLoop = useCallback(() => {
    if (rafRef.current) return; // Already running

    const tick = () => {
      const sim = simRef.current;
      if (!sim) return;

      // Sync all positions from simulation nodes into the override map
      for (const sn of simNodesRef.current) {
        positionsRef.current.set(sn.id, { x: sn.x ?? 0, y: sn.y ?? 0 });
      }

      // Notify canvas to repaint — no React re-render needed
      onTickRef.current?.();

      // Stop the loop when simulation has cooled and we're not dragging
      if (sim.alpha() < 0.005 && !draggingRef.current) {
        rafRef.current = null;
        onTickRef.current?.(); // Final repaint
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────────
  const onDragStart = useCallback(
    (nodeId: string, x: number, y: number) => {
      draggingRef.current = nodeId;

      const simNode = simNodeMapRef.current.get(nodeId);
      if (simNode) {
        // Pin the node to the drag position
        simNode.fx = x;
        simNode.fy = y;
      }

      // Gently reheat the simulation — connected nodes get a small tug
      const sim = simRef.current;
      if (sim) {
        sim.alpha(0.15).restart();
        startTickLoop();
      }
    },
    [startTickLoop]
  );

  const onDrag = useCallback((nodeId: string, x: number, y: number) => {
    // Update the pinned position to follow the cursor
    const simNode = simNodeMapRef.current.get(nodeId);
    if (simNode) {
      simNode.fx = x;
      simNode.fy = y;
    }

    // Keep the simulation warm while dragging (low alpha = gentle)
    const sim = simRef.current;
    if (sim && sim.alpha() < 0.05) {
      sim.alpha(0.1);
    }
  }, []);

  const onDragStop = useCallback((_nodeId: string) => {
    draggingRef.current = null;

    // Release the pin — node stays where it is but is no longer fixed
    const simNode = simNodeMapRef.current.get(_nodeId);
    if (simNode) {
      simNode.fx = null;
      simNode.fy = null;
    }

    // Simulation continues cooling naturally — the RAF loop will stop
    // when alpha drops below the threshold
  }, []);

  return {
    positionOverrides: positionsRef,
    onTickRef,
    onDragStart,
    onDrag,
    onDragStop,
  };
}
