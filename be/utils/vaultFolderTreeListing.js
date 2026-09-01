import fs from 'fs';
import path from 'path';

/** Nested folder tree of an unlocked vault mount (files + folders). */
export function buildVaultFolderListing(session, vaultRootOnMount, { maxDepth = 8 } = {}) {
  if (!session?.mountPath) return null;
  const root = vaultRootOnMount(session.mountPath);
  const rootName = path.basename(root) || '.recordvault';

  function readNode(absPath, name, depth) {
    let st = null;
    try {
      st = fs.lstatSync(absPath);
    } catch {
      return null;
    }
    if (st.isSymbolicLink()) {
      return { name, type: 'file', size: null };
    }
    if (st.isFile()) {
      return { name, type: 'file', size: st.size };
    }
    if (!st.isDirectory()) {
      return { name, type: 'file', size: null };
    }
    const node = { name, type: 'folder', children: [] };
    if (depth >= maxDepth) return node;
    let names = [];
    try {
      names = fs.readdirSync(absPath);
    } catch {
      return node;
    }
    const children = [];
    for (const childName of names) {
      const child = readNode(path.join(absPath, childName), childName, depth + 1);
      if (child) children.push(child);
    }
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    node.children = children;
    return node;
  }

  if (!fs.existsSync(root)) {
    return {
      path: root,
      label: path.basename(session.mountPath),
      tree: { name: rootName, type: 'folder', children: [] },
      entries: []
    };
  }

  const tree = readNode(root, root, 0) || { name: root, type: 'folder', children: [] };
  tree.name = root;
  const entries = (tree.children || []).map((child) => ({
    name: child.name,
    type: child.type,
    size: child.size ?? null
  }));
  return {
    path: root,
    label: path.basename(session.mountPath),
    tree,
    entries
  };
}
