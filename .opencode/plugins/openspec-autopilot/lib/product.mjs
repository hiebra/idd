// El producto evaluable de un paso (design D7 de autopilot-sesion-operativa):
// funciones puras que comparan la foto del change al empezar el paso con la de
// ahora, según el CLI de OpenSpec, y ordenan las revisiones.
//
// Foto: { change, artifacts: [ids en done], tasks: [ids marcadas], git }
// Productos:
//   { kind: "change", change }                    el change existe (paso new)
//   { kind: "artifact", id, paths }               un artefacto ha pasado a done
//   { kind: "tasks", ids, labels }                tasks recién marcadas (un solo producto)
//   { kind: "verdict", result }                   el veredicto del verify
//   { kind: "archive" }                           el change está archivado
//   { kind: "files" }                             han cambiado archivos (update, wiki)

export function snapshotOf(state, git = null) {
  return {
    change: state?.change ?? null,
    artifacts: (state?.status?.artifacts ?? []).filter((a) => a.status === 'done').map((a) => a.id),
    tasks: (state?.tasks ?? []).filter((t) => t.done).map((t) => String(t.id)),
    git,
  };
}

function artifactPaths(state, id) {
  const paths = state?.status?.artifactPaths?.[id]?.existingOutputPaths;
  return Array.isArray(paths) ? paths : [];
}

// Lo que ha cambiado en el plan y en las tasks entre dos fotos, en el orden del schema
export function planProducts(before, state) {
  const done = new Set(before?.artifacts ?? []);
  const products = [];
  for (const artifact of state?.status?.artifacts ?? []) {
    if (artifact.status === 'done' && !done.has(artifact.id)) products.push({ kind: 'artifact', id: artifact.id, paths: artifactPaths(state, artifact.id) });
  }
  const marked = new Set(before?.tasks ?? []);
  const tasks = (state?.tasks ?? []).filter((t) => t.done && !marked.has(String(t.id)));
  if (tasks.length > 0) products.push({ kind: 'tasks', ids: tasks.map((t) => String(t.id)), labels: tasks.map((t) => t.label ?? String(t.id)) });
  return products;
}

// productOf({ step, before, branch, state, handoff, git }) -> [productos]
//   branch: lo que dice branch-change.mjs ahora ({ kind, change })
//   state: changeState del change de la rama ahora (o null)
//   git: el estado de git ahora ({ signature })
export function productOf({ step, before = null, branch = null, state = null, handoff = null, git = null }) {
  switch (step?.kind) {
    case 'new': {
      if (branch?.kind !== 'active' || !branch.change) return [];
      return [{ kind: 'change', change: branch.change }, ...planProducts(before, state)];
    }
    case 'artifact':
    case 'task':
      return planProducts(before, state);
    case 'verify':
      return handoff?.result === 'clean' || handoff?.result === 'critical' ? [{ kind: 'verdict', result: handoff.result }] : [];
    case 'archive':
      return branch?.kind === 'archived' && (!before?.change || branch.change === before.change) ? [{ kind: 'archive' }] : [];
    case 'update':
    case 'wiki':
      return git && before?.git && git.signature !== before.git ? [{ kind: 'files' }] : [];
    default:
      return [];
  }
}

// Los productos que se revisan en el modo normal, en orden, y el paso de
// revisión de cada uno; los demás (el change creado, el archive, los archivos
// del wiki) no se revisan
export function reviewQueue(products, finished) {
  const queue = [];
  for (const product of products) {
    if (product.kind === 'artifact') queue.push({ product, step: { kind: 'review', id: product.id, of: 'artifact' } });
    else if (product.kind === 'tasks') queue.push({ product, step: { kind: 'review', id: product.ids.join(','), label: product.labels.join(', '), of: 'task' } });
    else if (product.kind === 'verdict') queue.push({ product, step: { kind: 'review', id: 'verify', of: 'verify' } });
    else if (product.kind === 'files' && finished?.kind === 'update') queue.push({ product, step: { kind: 'review', id: 'plan', of: 'plan' } });
  }
  return queue;
}

// Las rutas que pasan al stage para revisar un producto: las del artefacto y
// el .openspec.yaml del change; null es todo (`git add -A`): las tasks, los
// archivos y el último producto de la cola
export function stagePaths(product, { last = false, changeDir = null } = {}) {
  if (last || product?.kind !== 'artifact' || !product.paths?.length) return null;
  return changeDir ? [...product.paths, `${changeDir}/.openspec.yaml`] : [...product.paths];
}

// Una frase con lo producido, para la tool y los avisos
export function describeProducts(products) {
  return products
    .map((p) => {
      if (p.kind === 'change') return `el change ${p.change}`;
      if (p.kind === 'artifact') return `el artefacto ${p.id}`;
      if (p.kind === 'tasks') return p.labels.length === 1 ? `la task ${p.labels[0]}` : `las tasks ${p.labels.join(', ')}`;
      if (p.kind === 'verdict') return `el veredicto del verify (${p.result})`;
      if (p.kind === 'archive') return 'el archive';
      return 'cambios en los archivos';
    })
    .join(', ');
}
