import type { TreeTableNode, TreeNode } from "@/types";

export function buildTree(tables: TreeTableNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Pass 1: Create all nodes
  for (const t of tables) {
    nodeMap.set(t.name, {
      id: t.name,
      name: t.name,
      data: t,
      children: [],
    });
  }

  // Pass 2: Wire up parent-child relationships
  for (const t of tables) {
    const node = nodeMap.get(t.name)!;
    if (t.superClassName && nodeMap.has(t.superClassName)) {
      nodeMap.get(t.superClassName)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children alphabetically at each level
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.data.name.localeCompare(b.data.name));
    for (const n of nodes) {
      sortChildren(n.children);
    }
  };
  sortChildren(roots);

  return roots;
}

export function flattenTree(nodes: TreeNode[]): TreeTableNode[] {
  const result: TreeTableNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      result.push(node.data);
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export function findNode(
  nodes: TreeNode[],
  name: string
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === name) return node;
    const found = findNode(node.children, name);
    if (found) return found;
  }
  return undefined;
}

export function getAncestors(
  tables: TreeTableNode[],
  tableName: string
): string[] {
  const map = new Map(tables.map((t) => [t.name, t]));
  const chain: string[] = [];
  let current = map.get(tableName)?.superClassName;
  while (current) {
    chain.push(current);
    current = map.get(current)?.superClassName ?? null;
  }
  return chain;
}
