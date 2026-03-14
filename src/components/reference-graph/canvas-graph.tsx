"use client";

/* eslint-disable react-hooks/preserve-manual-memoization -- canvas drawing is imperative; React Compiler optimization not applicable */

import { useCallback, useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import { useGraphStore } from "@/stores/graph-store";
import type { LayoutNode, LayoutEdge } from "./types";

/** Deterministic color from scope name */
export function scopeHue(scopeName: string | null): number {
  if (!scopeName) return 220;
  let hash = 0;
  for (let i = 0; i < scopeName.length; i++) {
    hash = scopeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasGraphProps {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  positionOverrides: React.RefObject<Map<string, { x: number; y: number }>>;
  onTickRef: React.MutableRefObject<(() => void) | null>;
  onDragStart: (nodeId: string, x: number, y: number) => void;
  onDrag: (nodeId: string, x: number, y: number) => void;
  onDragStop: (nodeId: string) => void;
  focusTable: string | null;
  showLabels: boolean;
  showFields: boolean;
  showHierarchy: boolean;
  searchQuery: string;
}

export function CanvasGraph({
  nodes,
  edges,
  positionOverrides,
  onTickRef,
  onDragStart,
  onDrag,
  onDragStop,
  focusTable,
  showLabels,
  showFields,
  showHierarchy,
  searchQuery,
}: CanvasGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const rafRef = useRef<number | null>(null);
  const needsRepaintRef = useRef(true);

  // Interaction state — kept in refs to avoid React re-renders during drag
  const draggingNodeRef = useRef<string | null>(null);
  const dragStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartNodePosRef = useRef<{ x: number; y: number } | null>(null);
  /** True once we've crossed the 5px threshold and fired onDragStart */
  const dragSimStartedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // Build fast lookups from nodes/edges (rebuild when they change)
  const nodeMapRef = useRef(new Map<string, LayoutNode>());
  const edgesByNodeRef = useRef(new Map<string, Set<string>>()); // nodeId → set of connected nodeIds
  const edgeIndexRef = useRef(new Map<string, LayoutEdge>()); // edgeId → edge

  // Store subscriptions — read directly in draw loop
  const hoveredNodeRef = useRef<string | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  const hoveredEdgeRef = useRef<string | null>(null);
  const selectedEdgeRef = useRef<string | null>(null);

  // Subscribe to store for hover/select state
  useEffect(() => {
    const unsubHover = useGraphStore.subscribe(
      (state) => {
        hoveredNodeRef.current = state.hoveredNode;
        needsRepaintRef.current = true;
      }
    );
    const unsubSelect = useGraphStore.subscribe(
      (state) => {
        selectedNodeRef.current = state.selectedNode;
        needsRepaintRef.current = true;
      }
    );
    const unsubEdge = useGraphStore.subscribe(
      (state) => {
        selectedEdgeRef.current = state.selectedEdge;
        needsRepaintRef.current = true;
      }
    );
    // Seed from current state
    const s = useGraphStore.getState();
    hoveredNodeRef.current = s.hoveredNode;
    selectedNodeRef.current = s.selectedNode;
    selectedEdgeRef.current = s.selectedEdge;
    return () => { unsubHover(); unsubSelect(); unsubEdge(); };
  }, []);

  // Rebuild lookups when nodes/edges change
  useEffect(() => {
    const nm = new Map<string, LayoutNode>();
    for (const n of nodes) nm.set(n.id, n);
    nodeMapRef.current = nm;

    const ebn = new Map<string, Set<string>>();
    const ei = new Map<string, LayoutEdge>();
    for (const e of edges) {
      ei.set(e.id, e);
      if (!ebn.has(e.source)) ebn.set(e.source, new Set());
      if (!ebn.has(e.target)) ebn.set(e.target, new Set());
      ebn.get(e.source)!.add(e.target);
      ebn.get(e.target)!.add(e.source);
    }
    edgesByNodeRef.current = ebn;
    edgeIndexRef.current = ei;

    needsRepaintRef.current = true;
  }, [nodes, edges]);

  // Mark repaint needed when props change
  useEffect(() => {
    needsRepaintRef.current = true;
  }, [focusTable, showLabels, showFields, showHierarchy, searchQuery]);

  // Connect the onTickRef so the drag simulation can trigger repaints
  useEffect(() => {
    onTickRef.current = () => {
      needsRepaintRef.current = true;
    };
    return () => { onTickRef.current = null; };
  }, [onTickRef]);

  // ── Recenter logic (shared by auto-center and recenter button) ──────
  // Always fits all visible nodes to maintain the ball/cluster shape.
  const recenter = useCallback(() => {
    if (nodes.length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const { clientWidth: cw, clientHeight: ch } = container;
    // Guard: container not laid out yet
    if (cw === 0 || ch === 0) return;

    const overrides = positionOverrides.current;

    // Fit all nodes into the viewport
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const pos = overrides.get(n.id) ?? { x: n.x, y: n.y };
      minX = Math.min(minX, pos.x - n.radius);
      maxX = Math.max(maxX, pos.x + n.radius);
      minY = Math.min(minY, pos.y - n.radius);
      maxY = Math.max(maxY, pos.y + n.radius);
    }
    const graphW = maxX - minX || 1;
    const graphH = maxY - minY || 1;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const zoom = Math.min(cw / graphW, ch / graphH) * 0.85;
    viewportRef.current = {
      x: cw / 2 - centerX * zoom,
      y: ch / 2 - centerY * zoom,
      zoom: Math.max(0.05, Math.min(zoom, 3)),
    };
    needsRepaintRef.current = true;
  }, [nodes, positionOverrides]);

  // Auto-center: use ResizeObserver to detect when container is laid out,
  // plus recenter whenever nodes or focusTable change.
  const hasCenteredRef = useRef(false);

  // Reset the "has centered" flag when nodes change so we recenter
  useEffect(() => {
    hasCenteredRef.current = false;
  }, [nodes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0 && !hasCenteredRef.current) {
        hasCenteredRef.current = true;
        // Defer to next frame so all layout is settled
        requestAnimationFrame(() => recenter());
      }
    });
    observer.observe(container);

    // Also try immediately in case the container already has dimensions
    if (container.clientWidth > 0 && container.clientHeight > 0 && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      requestAnimationFrame(() => recenter());
    }

    return () => observer.disconnect();
  }, [recenter]);

  // ── Hit test: find node under a point in graph coordinates ──────────
  const hitTest = useCallback(
    (screenX: number, screenY: number): string | null => {
      const vp = viewportRef.current;
      const overrides = positionOverrides.current;
      // Convert screen → graph coordinates
      const gx = (screenX - vp.x) / vp.zoom;
      const gy = (screenY - vp.y) / vp.zoom;

      // Iterate in reverse (top-drawn last) for correct z-order
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const pos = overrides.get(n.id) ?? { x: n.x, y: n.y };
        const r = focusTable === n.id ? Math.max(n.radius, 20) : n.radius;
        const dx = gx - pos.x;
        const dy = gy - pos.y;
        if (dx * dx + dy * dy <= r * r) return n.id;
      }
      return null;
    },
    [nodes, focusTable, positionOverrides]
  );

  // ── Edge hit test: find edge near a screen point ─────────────────────
  const hitTestEdge = useCallback(
    (screenX: number, screenY: number): string | null => {
      const vp = viewportRef.current;
      const overrides = positionOverrides.current;
      // Convert screen → graph coordinates
      const gx = (screenX - vp.x) / vp.zoom;
      const gy = (screenY - vp.y) / vp.zoom;
      // Threshold in graph space — 8px screen / zoom
      const threshold = 8 / vp.zoom;

      let closestId: string | null = null;
      let closestDist = threshold;

      for (const e of edges) {
        if (e.type === "hierarchy" && !showHierarchy) continue;

        const srcPos = overrides.get(e.source) ?? nodeMapRef.current.get(e.source);
        const tgtPos = overrides.get(e.target) ?? nodeMapRef.current.get(e.target);
        if (!srcPos || !tgtPos) continue;

        // Point-to-line-segment distance
        const dx = tgtPos.x - srcPos.x;
        const dy = tgtPos.y - srcPos.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;

        const t = Math.max(0, Math.min(1,
          ((gx - srcPos.x) * dx + (gy - srcPos.y) * dy) / lenSq
        ));
        const nearX = srcPos.x + t * dx;
        const nearY = srcPos.y + t * dy;
        const dist = Math.sqrt((gx - nearX) ** 2 + (gy - nearY) ** 2);

        if (dist < closestDist) {
          closestDist = dist;
          closestId = e.id;
        }
      }

      return closestId;
    },
    [edges, positionOverrides, showHierarchy]
  );

  // ── Draw function ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: cw, clientHeight: ch } = canvas;

    // Resize canvas buffer if needed
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const vp = viewportRef.current;
    const overrides = positionOverrides.current;
    const activeNode = hoveredNodeRef.current || selectedNodeRef.current;

    // Build connected set for active node
    const connectedNodes = new Set<string>();
    const connectedEdgeKeys = new Set<string>();
    if (activeNode) {
      connectedNodes.add(activeNode);
      for (const e of edges) {
        if (e.source === activeNode || e.target === activeNode) {
          connectedNodes.add(e.source);
          connectedNodes.add(e.target);
          connectedEdgeKeys.add(e.id);
        }
      }
    }

    // Search matches — also match field element/label names on edges
    const searchLower = searchQuery.trim().toLowerCase();
    const hasSearch = searchLower.length > 0;

    // Pre-compute which nodes have matching edge fields (avoids O(n*m) in draw loop)
    const fieldMatchNodes = new Set<string>();
    const fieldMatchEdges = new Set<string>();
    if (hasSearch) {
      for (const e of edges) {
        const hasFieldMatch = e.fields.some(
          (f) =>
            f.element.toLowerCase().includes(searchLower) ||
            f.label.toLowerCase().includes(searchLower)
        );
        if (hasFieldMatch) {
          fieldMatchNodes.add(e.source);
          fieldMatchNodes.add(e.target);
          fieldMatchEdges.add(e.id);
        }
      }
    }

    // Apply viewport transform
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.zoom, vp.zoom);

    // ── Draw edges ────────────────────────────────────────────────────
    const hovEdge = hoveredEdgeRef.current;
    const selEdge = selectedEdgeRef.current;

    for (const e of edges) {
      const isHierarchy = e.type === "hierarchy";
      if (isHierarchy && !showHierarchy) continue;

      const srcPos = overrides.get(e.source) ?? nodeMapRef.current.get(e.source);
      const tgtPos = overrides.get(e.target) ?? nodeMapRef.current.get(e.target);
      if (!srcPos || !tgtPos) continue;

      const isHighlighted = connectedEdgeKeys.has(e.id);
      const isDimmed = activeNode !== null && !connectedEdgeKeys.has(e.id);
      const isEdgeHovered = e.id === hovEdge;
      const isEdgeSelected = e.id === selEdge;
      const isFieldSearchMatch = fieldMatchEdges.has(e.id);

      // Color by edge type: pink for references, cyan for hierarchy
      const refColor = "#ec4899";   // pink-500
      const hierColor = "#22d3ee";  // cyan-400

      if (isEdgeSelected || isEdgeHovered) {
        // Selected/hovered edge — bright and thick
        ctx.strokeStyle = isHierarchy ? hierColor : refColor;
        ctx.lineWidth = isEdgeSelected ? 4 : 3;
        ctx.globalAlpha = 1;
      } else if (isFieldSearchMatch) {
        // Edge contains a field matching the search — highlight yellow
        ctx.strokeStyle = "#facc15"; // yellow-400
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.9;
      } else if (isHighlighted) {
        ctx.strokeStyle = isHierarchy ? hierColor : refColor;
        ctx.lineWidth = Math.min(3, 1 + e.weight * 0.5);
        ctx.globalAlpha = 0.9;
      } else if (isDimmed) {
        ctx.strokeStyle = isHierarchy ? hierColor : "#6b7280";
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.08;
      } else {
        ctx.strokeStyle = isHierarchy ? hierColor : "#6b7280";
        ctx.lineWidth = isHierarchy ? 1.5 : Math.min(2, 0.5 + e.weight * 0.3);
        ctx.globalAlpha = isHierarchy ? 0.35 : 0.25;
      }

      // Hierarchy edges use dashed lines to distinguish from reference edges
      if (isHierarchy) ctx.setLineDash([6, 4]);

      ctx.beginPath();
      ctx.moveTo(srcPos.x, srcPos.y);
      ctx.lineTo(tgtPos.x, tgtPos.y);
      ctx.stroke();

      if (isHierarchy) ctx.setLineDash([]);

      // Directional arrowhead at target node — reference edges only, skip dimmed
      if (!isHierarchy && !isDimmed) {
        const tgtNode = nodeMapRef.current.get(e.target);
        const tgtRadius = tgtNode?.radius ?? 6;

        const dx = tgtPos.x - srcPos.x;
        const dy = tgtPos.y - srcPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Skip arrowheads on very short edges (node overlap)
        if (dist > tgtRadius + 12) {
          const angle = Math.atan2(dy, dx);

          // Arrow tip at the target node's circle edge
          const tipX = tgtPos.x - Math.cos(angle) * tgtRadius;
          const tipY = tgtPos.y - Math.sin(angle) * tgtRadius;

          // Arrowhead size scales with line width
          const arrowLen = Math.max(6, ctx.lineWidth * 3);

          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(
            tipX - Math.cos(angle - Math.PI / 7) * arrowLen,
            tipY - Math.sin(angle - Math.PI / 7) * arrowLen
          );
          ctx.lineTo(
            tipX - Math.cos(angle + Math.PI / 7) * arrowLen,
            tipY - Math.sin(angle + Math.PI / 7) * arrowLen
          );
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;

    // ── Draw field count badges on edges (when showFields is on) ─────
    if (showFields) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

      for (const e of edges) {
        // Only show on reference edges with fields
        if (e.type !== "reference" || e.fields.length === 0) continue;

        const srcPos = overrides.get(e.source) ?? nodeMapRef.current.get(e.source);
        const tgtPos = overrides.get(e.target) ?? nodeMapRef.current.get(e.target);
        if (!srcPos || !tgtPos) continue;

        // Skip dimmed edges
        const isDimmed = activeNode !== null && !connectedEdgeKeys.has(e.id);
        if (isDimmed) continue;

        // Draw badge at midpoint
        const mx = (srcPos.x + tgtPos.x) / 2;
        const my = (srcPos.y + tgtPos.y) / 2;
        const text = String(e.fields.length);
        const textWidth = ctx.measureText(text).width;
        const padX = 4;
        const padY = 2;
        const badgeW = textWidth + padX * 2;
        const badgeH = 12 + padY * 2;
        const cornerR = 4;

        // Background pill
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.beginPath();
        ctx.roundRect(mx - badgeW / 2, my - badgeH / 2, badgeW, badgeH, cornerR);
        ctx.fill();

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Text
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, mx, my);
      }
    }

    ctx.globalAlpha = 1;

    // ── Draw nodes ────────────────────────────────────────────────────
    const highlightColor = "#ec4899"; // pink-500
    const focusColor = "#3b82f6"; // blue-500

    // Pulse animation for focus table
    const pulsePhase = (Date.now() % 2000) / 2000;
    const pulseScale = 1 + 0.35 * Math.sin(pulsePhase * Math.PI * 2);
    const pulseAlpha = 0.6 * (1 - Math.abs(Math.sin(pulsePhase * Math.PI * 2)));

    for (const n of nodes) {
      const pos = overrides.get(n.id) ?? { x: n.x, y: n.y };
      const isFocus = focusTable !== null && n.id === focusTable;
      const isHovered = n.id === activeNode;
      const isConnected = activeNode !== null && n.id !== activeNode && connectedNodes.has(n.id);
      const isDimmed = activeNode !== null && !connectedNodes.has(n.id);
      const hue = scopeHue(n.scopeName);
      const effectiveRadius = isFocus ? Math.max(n.radius, 20) : n.radius;

      // Determine fill, stroke, opacity
      let fillColor: string;
      let strokeColor: string;
      let strokeWidth = 2;
      let opacity: number;

      if (isHovered) {
        fillColor = highlightColor;
        strokeColor = highlightColor;
        opacity = 1;
      } else if (isFocus && !isDimmed) {
        fillColor = focusColor;
        strokeColor = "#ffffff";
        strokeWidth = 3;
        opacity = 1;
      } else if (isConnected) {
        fillColor = hsl(hue, 50, 55);
        strokeColor = highlightColor;
        opacity = 1;
      } else if (isDimmed) {
        fillColor = hsl(hue, 20, 40);
        strokeColor = "transparent";
        opacity = 0.15;
      } else {
        fillColor = hsl(hue, 45, 55);
        strokeColor = hsl(hue, 45, 70);
        opacity = n.isOrphan ? 0.5 : 0.85;
      }

      // Search match highlight — includes field name matches from edges
      const isSearchMatch = hasSearch && (
        n.id.toLowerCase().includes(searchLower) ||
        n.label.toLowerCase().includes(searchLower) ||
        fieldMatchNodes.has(n.id)
      );
      if (isSearchMatch && !isHovered && !isConnected) {
        strokeColor = "#facc15"; // yellow-400
        opacity = 1;
      }

      ctx.globalAlpha = opacity;

      // Focus table pulse ring
      if (isFocus && !isDimmed) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (effectiveRadius + 4) * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = focusColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = pulseAlpha;
        ctx.stroke();
        ctx.globalAlpha = opacity;
      }

      // Focus table glow
      if (isFocus && !isDimmed) {
        ctx.shadowColor = focusColor;
        ctx.shadowBlur = 24;
      } else if (isHovered) {
        ctx.shadowColor = hexToRgba(highlightColor, 0.5);
        ctx.shadowBlur = 16;
      } else if (isConnected) {
        ctx.shadowColor = hexToRgba(highlightColor, 0.25);
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // Fill circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, effectiveRadius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Stroke circle
      if (strokeColor !== "transparent") {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    // ── Draw labels ───────────────────────────────────────────────────
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (const n of nodes) {
      const pos = overrides.get(n.id) ?? { x: n.x, y: n.y };
      const isFocus = focusTable !== null && n.id === focusTable;
      const isHovered = n.id === hoveredNodeRef.current;
      const isConnected = activeNode !== null && n.id !== activeNode && connectedNodes.has(n.id);
      const isDimmed = activeNode !== null && !connectedNodes.has(n.id);
      const isHighlighted = isHovered || isConnected;
      const effectiveRadius = isFocus ? Math.max(n.radius, 20) : n.radius;
      const zoomVisible = vp.zoom * n.radius > 35;

      // Label visibility logic — same as previous React Flow version
      const shouldShowLabel =
        isHovered ||
        isConnected ||
        (isFocus && !isDimmed) ||
        zoomVisible ||
        (showLabels && !isDimmed);

      if (!shouldShowLabel) continue;

      // Font size — hovered label stays readable at any zoom level (Obsidian-style)
      // by compensating for the canvas zoom transform
      const baseFontSize = isFocus ? 14 : Math.max(10, Math.min(13, 8 + n.radius * 0.15));
      const fontSize = isHovered
        ? Math.max(baseFontSize, 13 / vp.zoom) // ≥13px on screen regardless of zoom
        : baseFontSize;
      ctx.font = `${isFocus || isHighlighted ? 700 : 400} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      // Label offset from node — also compensate for hovered label at low zoom
      const labelGap = isHovered
        ? effectiveRadius + Math.max(4, 4 / vp.zoom)
        : effectiveRadius + (isFocus ? 8 : 4);

      // Text color
      if (isFocus && !isDimmed) {
        ctx.fillStyle = "#ffffff";
      } else if (isHighlighted) {
        ctx.fillStyle = "#f9fafb";
      } else {
        ctx.fillStyle = "#9ca3af";
      }

      // Draw text with shadow for readability
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = isHovered ? Math.max(3, 3 / vp.zoom) : 3;
      ctx.shadowOffsetY = isHovered ? Math.max(1, 1 / vp.zoom) : 1;
      ctx.fillText(n.label, pos.x, pos.y + labelGap);
      ctx.restore();
    }

    ctx.restore();
  }, [nodes, edges, positionOverrides, focusTable, showLabels, showFields, showHierarchy, searchQuery]);

  // ── Render loop ──────────────────────────────────────────────────────
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      // Always repaint during focus table animation (pulse ring)
      if (focusTable) needsRepaintRef.current = true;

      if (needsRepaintRef.current) {
        needsRepaintRef.current = false;
        draw();
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, focusTable]);

  // ── Mouse event handlers ─────────────────────────────────────────────
  const { setHoveredNode, setSelectedNode, setSelectedEdge } = useGraphStore();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const nodeId = hitTest(sx, sy);

      if (nodeId) {
        // Record potential drag — don't fire onDragStart yet.
        // We wait until the mouse moves >5px to distinguish click from drag.
        draggingNodeRef.current = nodeId;
        dragSimStartedRef.current = false;
        const vp = viewportRef.current;
        const gx = (sx - vp.x) / vp.zoom;
        const gy = (sy - vp.y) / vp.zoom;
        dragStartMouseRef.current = { x: sx, y: sy };
        dragStartNodePosRef.current = { x: gx, y: gy };
      } else {
        // Start panning
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          vx: viewportRef.current.x,
          vy: viewportRef.current.y,
        };
      }
    },
    [hitTest]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (draggingNodeRef.current) {
        const vp = viewportRef.current;
        const gx = (sx - vp.x) / vp.zoom;
        const gy = (sy - vp.y) / vp.zoom;

        // Only fire onDragStart once mouse moves >5px (distinguishes click from drag)
        if (!dragSimStartedRef.current) {
          const ds = dragStartMouseRef.current;
          if (ds && Math.sqrt((sx - ds.x) ** 2 + (sy - ds.y) ** 2) > 5) {
            dragSimStartedRef.current = true;
            onDragStart(draggingNodeRef.current, gx, gy);
          } else {
            return; // Not enough movement yet — don't move anything
          }
        }

        // Continue node drag
        onDrag(draggingNodeRef.current, gx, gy);
        // Update position override directly for immediate visual feedback
        positionOverrides.current.set(draggingNodeRef.current, { x: gx, y: gy });
        needsRepaintRef.current = true;
      } else if (isPanningRef.current && panStartRef.current) {
        // Continue panning
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        viewportRef.current.x = panStartRef.current.vx + dx;
        viewportRef.current.y = panStartRef.current.vy + dy;
        needsRepaintRef.current = true;
      } else {
        // Hover detection — nodes take priority over edges
        const nodeId = hitTest(sx, sy);
        if (nodeId !== hoveredNodeRef.current) {
          setHoveredNode(nodeId);
        }

        // Edge hover detection (only when not hovering a node)
        const edgeId = nodeId ? null : hitTestEdge(sx, sy);
        if (edgeId !== hoveredEdgeRef.current) {
          hoveredEdgeRef.current = edgeId;
          needsRepaintRef.current = true;
        }

        // Change cursor
        if (canvasRef.current) {
          canvasRef.current.style.cursor = nodeId ? "grab" : edgeId ? "pointer" : "default";
        }
      }
    },
    [hitTest, hitTestEdge, onDrag, positionOverrides, setHoveredNode]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingNodeRef.current) {
        if (dragSimStartedRef.current) {
          // Real drag — stop the simulation
          onDragStop(draggingNodeRef.current);
        } else {
          // Click (never exceeded 5px threshold) — toggle selection, no simulation involved
          const current = selectedNodeRef.current;
          setSelectedNode(current === draggingNodeRef.current ? null : draggingNodeRef.current);
        }

        draggingNodeRef.current = null;
        dragStartMouseRef.current = null;
        dragStartNodePosRef.current = null;
        dragSimStartedRef.current = false;
      }

      if (isPanningRef.current) {
        // Check if this was a click (not a pan) — no movement
        const ps = panStartRef.current;
        const isClick = ps && Math.abs(e.clientX - ps.x) < 3 && Math.abs(e.clientY - ps.y) < 3;
        if (isClick) {
          // Check if an edge is under the click
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const edgeId = hitTestEdge(sx, sy);
            if (edgeId) {
              // Select the edge (clears selectedNode via store)
              setSelectedEdge(selectedEdgeRef.current === edgeId ? null : edgeId);
            } else {
              // Clicked on truly empty space — deselect everything
              setSelectedNode(null);
              setSelectedEdge(null);
              setHoveredNode(null);
            }
          } else {
            setSelectedNode(null);
            setSelectedEdge(null);
            setHoveredNode(null);
          }
        }
        isPanningRef.current = false;
        panStartRef.current = null;
      }
    },
    [onDragStop, hitTestEdge, setSelectedNode, setSelectedEdge, setHoveredNode]
  );

  const handleMouseLeave = useCallback(() => {
    if (draggingNodeRef.current) {
      if (dragSimStartedRef.current) {
        onDragStop(draggingNodeRef.current);
      }
      draggingNodeRef.current = null;
      dragSimStartedRef.current = false;
    }
    isPanningRef.current = false;
    panStartRef.current = null;
    setHoveredNode(null);
  }, [onDragStop, setHoveredNode]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vp = viewportRef.current;

    // Zoom toward mouse position
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.max(0.05, Math.min(3, vp.zoom * zoomFactor));

    vp.x = mx - (mx - vp.x) * (newZoom / vp.zoom);
    vp.y = my - (my - vp.y) * (newZoom / vp.zoom);
    vp.zoom = newZoom;

    needsRepaintRef.current = true;
  }, []);

  // Prevent default wheel scroll on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", prevent, { passive: false });
    return () => canvas.removeEventListener("wheel", prevent);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ background: "#111827" }} // gray-900
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />

      {/* Recenter button — bottom-right, Google Maps style */}
      <button
        onClick={recenter}
        className="absolute bottom-3 right-3 z-10 p-2 rounded-lg border bg-background/90 backdrop-blur-sm shadow-md hover:bg-accent transition-colors"
        title={focusTable ? `Center on ${focusTable}` : "Fit all nodes"}
      >
        <Crosshair className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
