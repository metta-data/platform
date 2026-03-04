"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

function InheritanceEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: "#94a3b8",
        strokeWidth: 1.5,
        ...style,
      }}
    />
  );
}

function ReferenceEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  // When both handles are on the same side (loop-back to hierarchy node),
  // use a wider arc so the curve doesn't overlap the nodes
  const sameDirection = sourcePosition === targetPosition;
  const curvature = sameDirection ? 0.6 : 0.25;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature,
  });

  const label = data?.label as string | undefined;
  const highlighted = data?.highlighted as boolean | undefined;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: highlighted ? "#3b82f6" : "#93c5fd",
          strokeWidth: highlighted ? 2 : 1.5,
          ...(highlighted ? { strokeDasharray: "6 3" } : {}),
          ...style,
        }}
        markerEnd="url(#reference-arrow)"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute bg-background/90 text-[10px] text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const InheritanceEdge = memo(InheritanceEdgeComponent);
export const ReferenceEdge = memo(ReferenceEdgeComponent);
