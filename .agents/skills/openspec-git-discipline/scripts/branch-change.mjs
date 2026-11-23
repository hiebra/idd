#!/usr/bin/env node
// El change de la rama (openspec-change-lifecycle, design D1 de
// add-openspec-autopilot, D1 a D6 de manage-git-discipline, D3 a D7 de
// allow-user-requested-merges, D1 y D2 de git-discipline-standard-with-exception
// y D1 a D5 de name-change-in-merge-title):
// un módulo
// neutral, común a los dos agentes, que lee de git qué change tiene la rama
// actual y decide las puertas del ciclo. Lo importa el plugin de OpenCode y lo
// ejecutan los workflows de OpenSpec desde la skill openspec-git-discipline,
// con la que viaja (design D4 de windows-global-distro): en el proyecto, en
// .agents/skills/openspec-git-discipline/scripts/, o en la instalación
// global. Actúa siempre sobre el directorio desde el que se ejecuta.
//
// - Ramas permanentes: la lista `x-main` de openspec/config.yaml, o ["main"].
//   Su último elemento es la rama de origen. Solo se entiende una lista de
//   escalares simples, en flujo ([main, develop]) o en bloque (- main); con
//   cualquier otra forma la clave se trata como ausente y se avisa.
// - Veto (`protected`): `x-main-protected: true` en openspec/config.yaml
//   declara que el acceso directo a las ramas permanentes está vetado, y abre
//   la única excepción a la regla estándar del ciclo (ADR-0020). Sin la clave,
//   o con otro valor, no hay veto.
// - Rama temporal: cualquier rama local fuera de la lista; con HEAD separado
//   no hay ninguna.
// - Referencia de origen (`originRef`): la más avanzada de refs/heads/<origen>
//   y refs/remotes/origin/<origen>, cuando una contiene a la otra; si han
//   divergido, la local, con un aviso. No hace `git fetch`.
// - Changes de la rama: lo que hay hoy en openspec/changes/ y ha cambiado
//   entre el merge-base de HEAD con `originRef` y el árbol de trabajo, con
//   commit o sin él. openspec/changes/<nombre>/ es un change en curso y
//   openspec/changes/archive/<fecha>-<nombre>/, uno archivado. No cuenta un
//   change cuyo directorio está igual en `originRef` y en HEAD, sin cambios
//   sin commit: ya llegó a la rama de origen (por ejemplo, tras un squash).
//
// Resultado: { kind, branch, origin, originRef, permanent, protected, changes, change, warnings }
//   kind: "permanent" (rama permanente o HEAD separado), "unknown" (no se
//   encuentra la rama de origen), "none", "active", "archived" o "several".
//   originRef es null en una rama permanente o si no hay rama de origen.
//
// Puertas (check). La regla es la de la skill estándar de intent-driven, y
// nada de lo que permite se detiene ni lleva avisos; la excepción solo vale
// con el veto:
// - propose: en la rama permanente, sin avisos (con HEAD separado, no). En
//   una rama temporal, sin veto, deja seguir con un aviso (la regla prefiere
//   la rama de origen); con veto, solo si la rama no tiene otro change.
// - apply <change>: la regla, donde <change> esté en curso en el árbol de
//   trabajo (rama permanente, rama temporal o worktree) con su proposal.md ya
//   en `originRef`, o en la rama permanente. La excepción: el change de la
//   rama temporal, aunque su propuesta no esté en la rama de origen.
// - archive <change>: la regla, en la rama permanente si <change> está en
//   curso en el árbol de trabajo, tenga o no tasks sin hacer. La excepción:
//   en la rama temporal del change. En los dos casos no deja seguir si un ADR
//   nuevo de la rama repite el número de otro de `originRef`, o si dos ADRs
//   del árbol de trabajo tienen el mismo número.
// - commit: los commits y el push del agente. Solo deja seguir en un
//   contenedor efímero (CLAUDE_CODE_CONTAINER_ID no vacía y
//   CLAUDE_CODE_REMOTE=true), en la rama de la sesión guardada en
//   `git config idd.sessionBranch`, si es temporal y los cambios pendientes
//   son de una sola zona de spec-as-source (tasks.md y openspec/config.yaml
//   son neutros; el resto de openspec/, specs; todo lo demás, código). No
//   hace commit ni push: los autoriza, y su mensaje trae la orden de push.
//   Con una fusión en curso
//   (existe MERGE_HEAD) no mira las zonas, porque los commits que trae ya las
//   respetaban: exige que no quede ningún conflicto sin resolver
//   (`git diff --diff-filter=U`) ni ningún marcador (`<<<<<<<`, `=======` o
//   `>>>>>>>` al principio de línea) en los archivos que toca la fusión, y
//   da `git commit --no-edit` (ADR-0016).
// - merge <rama de destino> [<rama permanente>]: las fusiones que pide el
//   usuario (ADR-0016). No deja con el árbol sucio, ni en un contenedor
//   efímero fuera de la rama de la sesión. Si el destino es la rama temporal
//   actual, trae `origin/<rama permanente>` (por defecto, la de origen) y da
//   `git merge --no-edit`. Si es una rama permanente, solo deja si la rama
//   actual ya contiene `origin/<destino>` (si no, pide traerla antes); fuera
//   de un contenedor efímero da la fusión sin cambiar de rama
//   (`git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD` y
//   `git push origin <commit>:refs/heads/<destino>`), y dentro, abrir un PR
//   contra el destino, sin ninguna orden de push a él. No fusiona: da la
//   orden. Cualquier otro destino, no.
//   El título de la fusión con una rama permanente nombra los changes de la
//   rama, `Merge <changes> into <destino>`: todos, en curso o archivados, y
//   solo los de nombre kebab-case; sin ninguno, la rama. Es el `-m` de la
//   orden y, si la rama lleva algún change, el título del PR, que se
//   recomienda también para su commit de fusión; al PR de una rama sin
//   change la puerta no le da título.
// Todo rechazo dice cómo seguir.
//
// CLI:
//   node <script> --json
//   node <script> check <propose|apply|archive|commit> [<change>]
//   node <script> check merge <rama de destino> [<rama permanente>]
//   node <script> merge-targets [--json]
//   node <script> list [--json]
//   node <script> start <change>
//   node <script> switch <rama>
//   node <script> origin
//   node <script> env
// donde <script> es la ruta de este archivo.
// `check`, `start`, `switch` y `origin` imprimen { ok, message } en JSON, más
// `warning` cuando `check` deja seguir con un aviso, y salen con 0 si se puede
// seguir y con 1 si no. `list` da las ramas temporales con su
// change; `start` crea la rama del change desde la referencia de origen
// (`originRef`) y cambia a ella; `switch` cambia a una rama temporal (ADR-0013,
// design D12 de autopilot-sesion-operativa); `origin` vuelve a la rama de
// origen (design D7 de autopilot-rama-por-sesion), la única rama permanente a
// la que se cambia así. Ni `start`, ni `switch`, ni `origin` actúan con el
// árbol sucio. En un contenedor efímero no actúan: salen con 1, antes de
// comprobar nada más, y su mensaje dice que se siga en la rama de la sesión
// (ADR-0016). Fuera de él, el modelo solo usa `start` y `switch` con la
// excepción, o si el usuario lo pide (ADR-0020); en el ciclo del autopilot,
// el modelo no cambia de rama y los usa el plugin (ADR-0022). `merge-targets` da, tras el archive, las ramas de `x-main` a
// las que proponer la fusión, en el orden de la lista: omite las que no
// tienen origin/<rama> (con un aviso) y las cuyo origin/<rama> ya contiene
// HEAD, y marca con `bringFirst` las que hay que traer antes; no hace
// `git fetch` (ADR-0016). `env` imprime, para el arranque de
// sesión, `ephemeral=true` o `ephemeral=false` y
// `permanent=<ramas separadas por espacios>`.
//
// Sin dependencias: solo módulos node:.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = path.join('openspec', 'config.yaml');
const CHANGES = 'openspec/changes/';
const DEFAULT_PERMANENT = ['main'];
// La gramática con la que OpenSpec nombra los changes y `start` las ramas
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Cómo se ejecuta este script desde el proyecto `dir`, para los mensajes:
// relativo si está dentro del proyecto (plantilla completa) y absoluto si no
// (instalación global), entre comillas si tiene espacios
function selfCommand(dir) {
  const self = fileURLToPath(import.meta.url);
  const rel = path.relative(dir, self);
  const shown = rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : self;
  return /\s/.test(shown) ? `"${shown}"` : shown;
}

// git, sin los bloqueos opcionales: el plugin autopilot importa este módulo y
// lo lee en cada pantalla, y un `git status` o un `git diff` normales
// refrescan el índice tomando su bloqueo, con lo que un `git add` a la vez
// falla («index.lock: File exists»). Las órdenes que escriben siguen tomando
// el que necesitan
const NO_LOCKS = '--no-optional-locks';

function git(dir, ...args) {
  const result = spawnSync('git', [NO_LOCKS, ...args], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  return { ok: result.status === 0, out: (result.stdout ?? '').trim() };
}

function scalar(raw) {
  const value = raw.trim();
  const quoted = /^(['"])(.*)\1$/.exec(value);
  if (quoted) return quoted[2];
  return /^[A-Za-z0-9._/-]+$/.test(value) ? value : null;
}

// Lee la lista `x-main` del texto de openspec/config.yaml.
// Devuelve { permanent, warning }: permanent es null si la clave no está o no
// se entiende.
export function parsePermanent(text) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => /^x-main\s*:/.test(line));
  if (at === -1) return { permanent: null, warning: null };
  const invalid = {
    permanent: null,
    warning: "openspec/config.yaml: 'x-main' no es una lista de nombres de rama; se usa [main]",
  };
  const rest = lines[at].replace(/^x-main\s*:/, '').replace(/\s+#.*$/, '').trim();
  let items;
  if (rest.startsWith('[')) {
    const flow = /^\[(.*)\]$/.exec(rest);
    if (!flow) return invalid;
    items = flow[1].trim() === '' ? [] : flow[1].split(',').map(scalar);
  } else if (rest === '') {
    items = [];
    for (const line of lines.slice(at + 1)) {
      if (/^\s*(#.*)?$/.test(line)) continue;
      const item = /^\s+-\s+(.*?)\s*(#.*)?$/.exec(line);
      if (!item) break;
      items.push(scalar(item[1]));
    }
  } else {
    return invalid;
  }
  if (items.length === 0 || items.some((item) => !item)) return invalid;
  return { permanent: items, warning: null };
}

// Lee `x-main-protected` del texto de openspec/config.yaml: el veto del acceso
// directo a las ramas permanentes (design D1 de
// git-discipline-standard-with-exception). Solo `true` lo declara; sin la
// clave, o con cualquier otro valor, no hay veto.
export function parseProtected(text) {
  const line = text.split(/\r?\n/).find((l) => /^x-main-protected\s*:/.test(l));
  if (!line) return false;
  return scalar(line.replace(/^x-main-protected\s*:/, '').replace(/\s+#.*$/, '')) === 'true';
}

export function readProtected(dir) {
  try {
    return parseProtected(fs.readFileSync(path.join(dir, CONFIG), 'utf8'));
  } catch {
    return false;
  }
}

export function readPermanent(dir) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(dir, CONFIG), 'utf8');
  } catch {
    return { permanent: DEFAULT_PERMANENT, warning: null };
  }
  const { permanent, warning } = parsePermanent(text);
  return { permanent: permanent ?? DEFAULT_PERMANENT, warning };
}

// Los changes de una lista de rutas de openspec/changes/ que existen hoy
export function changesOf(paths) {
  const found = new Map();
  for (const file of paths) {
    if (!file.startsWith(CHANGES)) continue;
    const parts = file.slice(CHANGES.length).split('/');
    if (parts.length < 2) continue;
    if (parts[0] === 'archive') {
      if (parts.length < 3) continue;
      const name = parts[1].replace(/^\d{4}-\d{2}-\d{2}-/, '');
      found.set(`archived:${name}`, { name, state: 'archived', dir: `${CHANGES}archive/${parts[1]}` });
    } else {
      found.set(`active:${parts[0]}`, { name: parts[0], state: 'active', dir: `${CHANGES}${parts[0]}` });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.state.localeCompare(b.state));
}

// La referencia de origen (design D1 de manage-git-discipline): la más
// avanzada de refs/heads/<origen> y refs/remotes/origin/<origen>; si han
// divergido, la local, con un aviso. Devuelve { ref, warning }.
export function originRefOf(dir, origin) {
  const local = `refs/heads/${origin}`;
  const remote = `refs/remotes/origin/${origin}`;
  const has = (ref) => git(dir, 'rev-parse', '--verify', '-q', ref).ok;
  const [hasLocal, hasRemote] = [has(local), has(remote)];
  if (!hasLocal && !hasRemote) return { ref: null, warning: null };
  if (!hasRemote) return { ref: local, warning: null };
  if (!hasLocal) return { ref: remote, warning: null };
  const ancestor = (a, b) => git(dir, 'merge-base', '--is-ancestor', a, b).ok;
  if (ancestor(remote, local)) return { ref: local, warning: null };
  if (ancestor(local, remote)) return { ref: remote, warning: null };
  return {
    ref: local,
    warning: `la rama de origen local '${origin}' y 'origin/${origin}' han divergido; el merge-base se calcula contra la local`,
  };
}

// Un change cuyo directorio está igual en la rama de origen y en HEAD, sin
// cambios sin commit, ya llegó a la rama de origen (design D2): por ejemplo,
// tras un squash
function alreadyInOrigin(dir, originRef, change) {
  const there = git(dir, 'rev-parse', '-q', '--verify', `${originRef}:${change.dir}`);
  const here = git(dir, 'rev-parse', '-q', '--verify', `HEAD:${change.dir}`);
  if (!there.ok || !here.ok || there.out !== here.out) return false;
  return git(dir, 'status', '--porcelain', '--untracked-files=all', '--', change.dir).out === '';
}

export function branchChange(dir = process.cwd()) {
  const { permanent, warning } = readPermanent(dir);
  const origin = permanent.at(-1);
  const warnings = warning ? [warning] : [];
  const base = { branch: null, origin, originRef: null, permanent, protected: readProtected(dir), changes: [], change: null, warnings };

  const head = git(dir, 'symbolic-ref', '--short', '-q', 'HEAD');
  if (!head.ok || !head.out) return { ...base, kind: 'permanent' };
  const branch = head.out;
  if (permanent.includes(branch)) return { ...base, branch, kind: 'permanent' };

  const { ref, warning: divergence } = originRefOf(dir, origin);
  if (!ref) {
    return { ...base, branch, kind: 'unknown', warnings: [...warnings, `no se encuentra la rama de origen '${origin}' (ni local ni en origin)`] };
  }
  if (divergence) warnings.push(divergence);
  const mergeBase = git(dir, 'merge-base', 'HEAD', ref);
  if (!mergeBase.ok) {
    return { ...base, branch, originRef: ref, kind: 'unknown', warnings: [...warnings, `la rama '${branch}' no tiene merge-base con '${origin}'`] };
  }
  const diff = git(dir, 'diff', '--name-only', mergeBase.out, '--', CHANGES);
  const untracked = git(dir, 'ls-files', '--others', '--exclude-standard', '--', CHANGES);
  const paths = [...diff.out.split('\n'), ...untracked.out.split('\n')]
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(dir, file)));
  const changes = changesOf(paths).filter((c) => !alreadyInOrigin(dir, ref, c));
  const names = new Set(changes.map((c) => c.name));
  let kind = 'none';
  if (names.size > 1) kind = 'several';
  else if (names.size === 1) kind = changes.some((c) => c.state === 'active') ? 'active' : 'archived';
  const change = names.size === 1 ? changes[0].name : null;
  return { ...base, branch, originRef: ref, kind, changes, change };
}

// Un contenedor efímero (design D4 de manage-git-discipline): la sesión en
// la nube, con CLAUDE_CODE_CONTAINER_ID no vacía y CLAUDE_CODE_REMOTE=true
export function isEphemeral(env = process.env) {
  return Boolean(env.CLAUDE_CODE_CONTAINER_ID) && env.CLAUDE_CODE_REMOTE === 'true';
}

// La zona de spec-as-source de una ruta: los tasks.md y openspec/config.yaml
// son neutros (config.yaml es la configuración de OpenSpec, no una spec, y
// /toggle-wiki lo cambia junto con código: D11 de add-project-wiki-toggle),
// el resto de openspec/ es la zona de specs y todo lo demás, la de código
export function zoneOf(file) {
  if (path.posix.basename(file) === 'tasks.md' || file === 'openspec/config.yaml') return null;
  return file.startsWith('openspec/') ? 'specs' : 'code';
}

// Las rutas con cambios sin commit o sin seguimiento
function pendingPaths(dir) {
  const status = spawnSync('git', [NO_LOCKS, 'status', '--porcelain', '-z', '--untracked-files=all'], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  const entries = (status.stdout ?? '').split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const code = entries[i].slice(0, 2);
    paths.push(entries[i].slice(3));
    // Un renombrado trae después la ruta de origen
    if (/[RC]/.test(code)) paths.push(entries[++i]);
  }
  return paths;
}

const ADR = /^adr\/(\d{4})-[^/]*\.md$/;

function adrNumber(file) {
  return ADR.exec(file)?.[1] ?? null;
}

// Los ADRs con número repetido (design D6): dos del árbol de trabajo con el
// mismo número, o uno nuevo de la rama con el número de otro de la rama de
// origen. Devuelve un mensaje de rechazo, o null.
function adrClash(dir, state) {
  let files = [];
  try {
    files = fs.readdirSync(path.join(dir, 'adr')).map((name) => `adr/${name}`);
  } catch {
    return null;
  }
  const renumber = (number) =>
    `renumera ${number} en los ADRs nuevos de la rama con el siguiente número libre (el más alto de \`adr/\` en todas las ramas de origin, tras un \`git fetch\`), actualiza sus referencias y vuelve a ejecutar la puerta`;
  if (state.originRef) {
    const mergeBase = git(dir, 'merge-base', 'HEAD', state.originRef);
    if (mergeBase.ok) {
      const added = [
        ...git(dir, 'diff', '--name-only', '--diff-filter=A', mergeBase.out, '--', 'adr/').out.split('\n'),
        ...git(dir, 'ls-files', '--others', '--exclude-standard', '--', 'adr/').out.split('\n'),
      ].filter((file) => adrNumber(file) && fs.existsSync(path.join(dir, file)));
      const inOrigin = git(dir, 'ls-tree', '--name-only', `${state.originRef}:adr/`).out.split('\n').filter(Boolean).map((name) => `adr/${name}`);
      for (const file of added) {
        const other = inOrigin.find((o) => o !== file && adrNumber(o) === adrNumber(file));
        if (other) {
          return `El ADR nuevo '${file}' usa el número ${adrNumber(file)}, que ya tiene '${other}' en la rama de origen '${state.origin}': ${renumber(adrNumber(file))}.`;
        }
      }
    }
  }
  const seen = new Map();
  for (const file of files.filter(adrNumber)) {
    const number = adrNumber(file);
    if (seen.has(number)) return `Hay dos ADRs con el número ${number} ('${seen.get(number)}' y '${file}'): ${renumber(number)}.`;
    seen.set(number, file);
  }
  return null;
}

function activeHere(dir, name) {
  return Boolean(name) && fs.existsSync(path.join(dir, CHANGES, name, 'proposal.md'));
}

// Un marcador de conflicto al principio de línea (design D3 de
// allow-user-requested-merges): `<<<<<<<` y `>>>>>>>` solos o seguidos de un
// espacio, y `=======` como línea entera
const CONFLICT_MARKER = /^(?:<{7}(?: |$)|={7}$|>{7}(?: |$))/m;

// Los archivos tocados por la fusión en curso (con stage o sin él) que
// conservan un marcador de conflicto; se saltan los borrados y los binarios
function filesWithMarkers(dir) {
  const touched = git(dir, 'diff', '--name-only', 'HEAD').out.split('\n').filter(Boolean);
  return touched.filter((file) => {
    let content;
    try {
      content = fs.readFileSync(path.join(dir, file));
    } catch {
      return false;
    }
    if (content.includes(0)) return false;
    return CONFLICT_MARKER.test(content.toString('utf8'));
  });
}

// El commit de una fusión en curso (design D3 de allow-user-requested-merges):
// no se comprueban las zonas, porque cada commit que trae la fusión ya las
// respetaba; sí que no quede ningún conflicto sin resolver ni ningún marcador
function checkMergeCommit(dir, branch, state) {
  const deny = (message) => ({ ok: false, message, state });
  const unresolved = git(dir, 'diff', '--name-only', '--diff-filter=U').out.split('\n').filter(Boolean);
  if (unresolved.length > 0) {
    return deny(
      `La fusión en curso tiene conflictos sin resolver en ${unresolved.join(', ')}: resuélvelos, presenta la resolución al usuario y, con su ok, ` +
        'pásalos al stage (`git add <rutas>`) y vuelve a ejecutar la puerta. Para descartar la fusión: `git merge --abort`.'
    );
  }
  const marked = filesWithMarkers(dir);
  if (marked.length > 0) {
    return deny(
      `La fusión en curso conserva marcadores de conflicto (\`<<<<<<<\`, \`=======\` o \`>>>>>>>\` al principio de línea) en ${marked.join(', ')}: ` +
        'quita los marcadores, pasa los archivos al stage (`git add <rutas>`) y vuelve a ejecutar la puerta.'
    );
  }
  return {
    ok: true,
    message: `Se puede hacer el commit de la fusión en curso en la rama de la sesión '${branch}', si el usuario dio el ok a la resolución: git commit --no-edit; después, el push: git push -u origin ${branch}`,
    state,
  };
}

// La puerta commit (design D4): los commits y el push del agente en la rama
// de la sesión de un contenedor efímero
export function checkCommit(dir, env = process.env) {
  const state = branchChange(dir);
  const deny = (message) => ({ ok: false, message, state });
  if (!isEphemeral(env)) {
    return deny('La sesión no está en un contenedor efímero: los commits los hace el usuario. Pídele el commit y espera a que lo haga o te diga que sigas sin él.');
  }
  const saved = git(dir, 'config', '--get', 'idd.sessionBranch');
  const branch = state.branch;
  if (!saved.ok || !saved.out) {
    return deny('No hay rama de la sesión guardada (git config idd.sessionBranch): el agente solo hace commits en la rama de la sesión. Pide el commit al usuario; el arranque de la sesión la guarda en la siguiente sesión.');
  }
  if (branch !== saved.out) {
    const where = branch ? `la rama '${branch}'` : 'un HEAD separado';
    return deny(`El clon está en ${where} y la rama de la sesión es '${saved.out}': los commits del agente van solo a la rama de la sesión. No cambies de rama tú; pide al usuario cómo seguir.`);
  }
  if (state.permanent.includes(branch)) {
    return deny(`'${branch}' es una rama permanente: los commits del agente van solo a una rama temporal. Pide el commit al usuario.`);
  }
  if (git(dir, 'rev-parse', '-q', '--verify', 'MERGE_HEAD').ok) return checkMergeCommit(dir, branch, state);
  const zones = { specs: [], code: [] };
  for (const file of pendingPaths(dir)) {
    const zone = zoneOf(file);
    if (zone) zones[zone].push(file);
  }
  if (zones.specs.length > 0 && zones.code.length > 0) {
    return deny(
      `Los cambios pendientes mezclan la zona de specs (${zones.specs.join(', ')}) y la de código (${zones.code.join(', ')}): ` +
        'un commit es de una sola zona. Aparta una de ellas (por ejemplo, `git stash push -- <rutas>`), haz el commit de la otra y vuelve a ejecutar la puerta.'
    );
  }
  return { ok: true, message: `Se puede hacer commit en la rama de la sesión '${branch}'; después, el push: git push -u origin ${branch}`, state };
}

// El título de la fusión con una rama permanente (design D1 a D3 de
// name-change-in-merge-title): nombra los changes de la rama, en curso o
// archivados, sin repetir y en el orden de `changes`; sin ninguno, la rama.
// Solo nombra los changes con nombre kebab-case, porque el título va dentro
// de una orden de shell y el nombre de un directorio puede traer cualquier cosa.
function titleChanges(state) {
  return [...new Set(state.changes.map((c) => c.name))].filter((name) => KEBAB.test(name));
}

export function mergeTitle(state, target) {
  const names = titleChanges(state);
  return `Merge ${names.length > 0 ? names.join(', ') : state.branch} into ${target}`;
}

// La puerta merge (design D4 de allow-user-requested-merges): las fusiones
// del ciclo. `target` es la rama de destino; `source`, la rama permanente que
// se trae a la rama actual (por defecto, la rama de origen). No fusiona: da
// la orden.
export function checkMerge(dir, target, source, env = process.env) {
  const state = branchChange(dir);
  const deny = (message) => ({ ok: false, message, state });
  const allow = (message) => ({ ok: true, message, state });
  const branch = state.branch;
  if (!target) return deny('Falta la rama de destino: check merge <rama de destino> [<rama permanente>].');
  if (dirty(dir)) return deny(`No se fusiona: ${COMMIT_FIRST}.`);
  if (isEphemeral(env)) {
    const saved = git(dir, 'config', '--get', 'idd.sessionBranch');
    if (!saved.ok || !saved.out || branch !== saved.out) {
      const where = branch ? `la rama '${branch}'` : 'un HEAD separado';
      const session = saved.ok && saved.out ? `la rama de la sesión es '${saved.out}'` : 'no hay rama de la sesión guardada (git config idd.sessionBranch)';
      return deny(`El clon está en ${where} y ${session}: en un contenedor efímero solo se fusiona en la rama de la sesión. No cambies de rama tú; pide al usuario cómo seguir.`);
    }
  }
  const remote = (name) => git(dir, 'rev-parse', '-q', '--verify', `refs/remotes/origin/${name}`).ok;
  const contains = (ancestor) => git(dir, 'merge-base', '--is-ancestor', ancestor, 'HEAD').ok;

  // Traer una rama permanente a la rama temporal actual
  if (target === branch && !state.permanent.includes(branch)) {
    const from = source ?? state.origin;
    if (!state.permanent.includes(from)) return deny(`'${from}' no es una rama permanente: check merge solo trae a la rama temporal una rama de x-main.`);
    if (!remote(from)) return deny(`No existe 'origin/${from}': trae la rama con \`git fetch origin ${from}\` y vuelve a ejecutar la puerta.`);
    if (contains(`refs/remotes/origin/${from}`)) {
      return allow(`La rama '${branch}' ya contiene \`origin/${from}\`: no hay nada que traer.`);
    }
    return allow(
      `Se puede traer \`origin/${from}\` a la rama temporal '${branch}': \`git fetch origin ${from}\` y \`git merge --no-edit origin/${from}\`. ` +
        'Si hay conflictos, resuélvelos y presenta al usuario cada decisión de la resolución; sin su ok no hagas el commit de fusión. ' +
        'En un contenedor efímero, el commit pasa por `check commit`; fuera de él, el commit (`git commit --no-edit`) lo hace el usuario.'
    );
  }
  // Llevar la rama temporal actual a una rama permanente
  if (state.permanent.includes(target) && branch && !state.permanent.includes(branch)) {
    if (!remote(target)) return deny(`No existe 'origin/${target}': trae la rama con \`git fetch origin ${target}\` y vuelve a ejecutar la puerta.`);
    if (!contains(`refs/remotes/origin/${target}`)) {
      return deny(
        `La rama '${branch}' no contiene \`origin/${target}\`: trae antes \`origin/${target}\` a la rama temporal con la puerta ` +
          `\`node ${selfCommand(dir)} check merge ${branch} ${target}\`, para que no haya conflictos que resolver en '${target}', y vuelve a ejecutar esta.`
      );
    }
    if (isEphemeral(env)) {
      // El PR de una rama con change lleva el título de la fusión, y se
      // recomienda para su commit de fusión. Sin change, la puerta no da
      // título: el PR lo titula el agente, como antes (design D5 de
      // name-change-in-merge-title)
      const title = titleChanges(state).length > 0 ? mergeTitle(state, target) : null;
      return allow(
        `Se puede llevar la rama de la sesión '${branch}' a '${target}' por PR: sube la rama (\`git push -u origin ${branch}\`), ` +
          `abre un PR de \`${branch}\` contra \`${target}\` con las herramientas de GitHub de la sesión` +
          (title ? `, con el título \`${title}\` (si el PR ya está abierto, ponle ese título),` : '') +
          ' y recomienda al usuario fusionarlo con un commit de fusión, no con squash' +
          (title ? ', y con ese mismo título en el commit de fusión: el que propone GitHub nombra la rama de la sesión, no el change' : '') +
          `. En un contenedor efímero no hagas push a '${target}': el PR lo fusiona el usuario.`
      );
    }
    return allow(
      `Se puede llevar la rama temporal '${branch}' a '${target}' sin cambiar de rama, con el commit que daría \`git merge --no-ff\` desde '${target}': ` +
        `\`commit=$(git commit-tree HEAD^{tree} -p origin/${target} -p HEAD -m "${mergeTitle(state, target)}")\` y \`git push origin "$commit":refs/heads/${target}\`; ` +
        `después, \`git fetch origin ${target}\`. Si el push se deniega, da al usuario la orden exacta, con el commit ya creado, y detente; ` +
        `si el remoto lo rechaza por no ser un avance rápido, trae otra vez \`origin/${target}\` y repite la puerta.`
    );
  }
  return deny(
    `check merge no admite el destino '${target}' desde ${branch ? `la rama '${branch}'` : 'un HEAD separado'}: ` +
      'trae una rama permanente a la rama temporal actual (`check merge <rama actual> [<rama permanente>]`) o lleva la rama temporal actual a una rama permanente (`check merge <rama permanente>`).'
  );
}

// Las puertas del ciclo (design D2 de add-openspec-autopilot, D3 de
// manage-git-discipline, D4 de allow-user-requested-merges): propose, apply,
// archive, commit y merge
export function check(dir, gate, name, { env = process.env, source = null } = {}) {
  if (gate === 'commit') return checkCommit(dir, env);
  if (gate === 'merge') return checkMerge(dir, name, source ?? undefined, env);
  const state = branchChange(dir);
  const newBranch = `crea una rama temporal desde la rama de origen ('git switch -c <rama> ${state.origin}') y sigue en ella`;
  const named = state.changes.map((c) => c.name).join(', ');
  const deny = (message) => ({ ok: false, message, state });
  const allow = (message, warning = null) => ({ ok: true, message, ...(warning ? { warning } : {}), state });
  if (!['propose', 'apply', 'archive'].includes(gate)) return deny(`puerta desconocida '${gate}': usa propose, apply, archive, commit o merge.`);
  if (gate !== 'propose' && !name) return deny(`Falta el nombre del change para la puerta '${gate}': check ${gate} <change>.`);

  if (state.kind === 'permanent') {
    if (!state.branch) return deny(`El clon está en un HEAD separado: ${newBranch}.`);
    const where = `la rama permanente '${state.branch}'`;
    if (gate === 'propose') {
      return allow(`Se puede proponer en ${where}.`);
    }
    if (!activeHere(dir, name)) {
      if (gate === 'archive') {
        return deny(`'${name}' no está en curso en ${where}: el archive se hace donde está en curso, en la rama de origen después de fusionar la implementación${state.protected ? ', o en su rama temporal (excepción: x-main-protected)' : ''}.`);
      }
      return deny(`'${name}' no está en curso en ${where}: aplícalo donde esté en curso, con su propuesta ya en la rama de origen${state.protected ? ', o en su rama temporal (excepción: x-main-protected)' : ''}.`);
    }
    if (gate === 'apply') {
      return allow(`Se puede aplicar '${name}' en ${where}.`);
    }
    const clash = adrClash(dir, state);
    if (clash) return deny(clash);
    return allow(`Se puede archivar '${name}' en ${where}.`);
  }

  // Proponer en una rama temporal sin la excepción: la regla lo permite, con el
  // aviso de la skill estándar ("Prefer main; if not, warn and ask")
  if (gate === 'propose' && !state.protected) {
    return allow(
      `Se puede proponer en la rama temporal '${state.branch}'.`,
      `La regla prefiere proponer en la rama de origen '${state.origin}': pregunta al usuario si sigue aquí a propósito. La propuesta tendrá que llegar a '${state.origin}' antes del apply.`
    );
  }
  if (state.kind === 'unknown') {
    return deny(`No se puede leer el change de la rama: ${state.warnings.at(-1)}. Trae la rama de origen ('git fetch origin ${state.origin}') y vuelve a ejecutar la puerta.`);
  }
  // El apply (design D2 de git-discipline-standard-with-exception). La regla:
  // el change en curso en el árbol de trabajo, con su propuesta ya en la rama
  // de origen. La excepción, solo con x-main-protected: true: el change de la
  // rama temporal, aunque su propuesta no esté en la rama de origen.
  if (gate === 'apply') {
    const inOrigin = Boolean(state.originRef) &&
      git(dir, 'rev-parse', '-q', '--verify', `${state.originRef}:${CHANGES}${name}/proposal.md`).ok;
    if (activeHere(dir, name) && inOrigin) {
      return allow(`Se puede aplicar '${name}' en la rama temporal '${state.branch}': su propuesta ya está en la rama de origen '${state.origin}'.`);
    }
    if (state.protected && state.kind === 'active' && state.change === name) {
      return allow(`Se puede aplicar '${name}' en la rama temporal '${state.branch}' (excepción: x-main-protected).`);
    }
    if (!state.protected) {
      return deny(
        `La propuesta de '${name}' no está en la rama de origen '${state.origin}': la regla pide que llegue antes a la rama de origen. ` +
          `Fusiona la propuesta con '${state.origin}' y aplica allí, en una rama o en un worktree. ` +
          `Si el acceso directo a las ramas permanentes está vetado, declara \`x-main-protected: true\` en openspec/config.yaml.`
      );
    }
  }
  // El archive en una rama temporal solo lo permite la excepción
  if (gate === 'archive' && !state.protected) {
    return deny(
      `No se archiva '${name}' en la rama temporal '${state.branch}': la regla es archivar en la rama de origen '${state.origin}' tras fusionar la implementación. ` +
        `Fusiona la rama con '${state.origin}' y archiva allí. Si el acceso directo a las ramas permanentes está vetado, declara \`x-main-protected: true\` en openspec/config.yaml.`
    );
  }
  if (state.kind === 'several') {
    return deny(
      `La rama '${state.branch}' tiene varios changes (${named}); tiene que quedar uno solo: lleva cada uno de los demás a su propia rama temporal ` +
        `('git switch -c <rama> ${state.origin}' y mueve allí su directorio de openspec/changes/), quítalos de esta y vuelve a ejecutar la puerta.`
    );
  }
  if (gate === 'propose') {
    if (state.kind === 'none') return allow(`La rama '${state.branch}' no tiene change: se puede proponer uno.`);
    return deny(`La rama '${state.branch}' ya tiene el change '${state.change}': un change por rama. Para proponer otro, ${newBranch}.`);
  }
  if (state.kind === 'active' && state.change === name) {
    if (gate === 'archive') {
      const clash = adrClash(dir, state);
      if (clash) return deny(clash);
      return allow(`Se puede archivar '${name}' en la rama temporal '${state.branch}'.`);
    }
    return allow(`Se puede aplicar '${name}' en la rama temporal '${state.branch}'.`);
  }
  const has = state.kind === 'none' ? 'no tiene ningún change en curso' : `tiene el change ${state.kind === 'archived' ? 'archivado' : 'en curso'} '${state.change}'`;
  return deny(`El ${gate} de '${name}' se hace en su rama temporal, y la rama '${state.branch}' ${has}: cambia a la rama temporal de '${name}', o ${newBranch} si su propuesta ya está en '${state.origin}'.`);
}

// La rama de origen como referencia de git: la local, o la de origin
// La referencia de la que salen y contra la que se comparan las ramas
// temporales: la misma que usan las puertas (originRefOf)
function originRef(dir, origin) {
  return originRefOf(dir, origin).ref;
}

// Las ramas temporales con su change: [{ branch, current, kind, change, changes }]
export function listBranches(dir = process.cwd()) {
  const { permanent } = readPermanent(dir);
  const origin = permanent.at(-1);
  const ref = originRef(dir, origin);
  const current = git(dir, 'symbolic-ref', '--short', '-q', 'HEAD').out;
  const names = git(dir, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').out.split('\n').filter(Boolean);
  const result = [];
  for (const branch of names) {
    if (permanent.includes(branch)) continue;
    if (branch === current) {
      const state = branchChange(dir);
      result.push({ branch, current: true, kind: state.kind, change: state.change, changes: state.changes.map((c) => c.name) });
      continue;
    }
    if (!ref) {
      result.push({ branch, current: false, kind: 'unknown', change: null, changes: [] });
      continue;
    }
    const base = git(dir, 'merge-base', branch, ref);
    if (!base.ok) {
      result.push({ branch, current: false, kind: 'unknown', change: null, changes: [] });
      continue;
    }
    const diff = git(dir, 'diff', '--name-only', base.out, branch, '--', CHANGES).out.split('\n').filter(Boolean);
    const tree = new Set(git(dir, 'ls-tree', '-r', '--name-only', branch, '--', CHANGES).out.split('\n').filter(Boolean));
    const changes = changesOf(diff.filter((file) => tree.has(file)));
    const unique = new Set(changes.map((c) => c.name));
    let kind = 'none';
    if (unique.size > 1) kind = 'several';
    else if (unique.size === 1) kind = changes.some((c) => c.state === 'active') ? 'active' : 'archived';
    result.push({ branch, current: false, kind, change: unique.size === 1 ? changes[0].name : null, changes: [...unique] });
  }
  return result;
}

// Las ramas a las que proponer la fusión tras el archive (design D6 de
// allow-user-requested-merges): cada rama de `x-main`, en el orden de la
// lista, salvo las que no tienen origin/<rama> (con un aviso) y las cuyo
// origin/<rama> ya contiene HEAD. `bringFirst`: HEAD no contiene
// origin/<rama> y hay que traerla antes. En una rama permanente o con HEAD
// separado no da ninguna. No hace `git fetch`.
export function mergeTargets(dir = process.cwd()) {
  const { permanent, warning } = readPermanent(dir);
  const warnings = warning ? [warning] : [];
  const branch = git(dir, 'symbolic-ref', '--short', '-q', 'HEAD').out || null;
  if (!branch || permanent.includes(branch)) return { branch, targets: [], warnings };
  const targets = [];
  for (const name of permanent) {
    const ref = `refs/remotes/origin/${name}`;
    if (!git(dir, 'rev-parse', '-q', '--verify', ref).ok) {
      warnings.push(`no existe 'origin/${name}': no se propone la fusión con '${name}' (haz antes \`git fetch origin ${name}\`)`);
      continue;
    }
    if (git(dir, 'merge-base', '--is-ancestor', 'HEAD', ref).ok) continue;
    targets.push({ branch: name, bringFirst: !git(dir, 'merge-base', '--is-ancestor', ref, 'HEAD').ok });
  }
  return { branch, targets, warnings };
}

const dirty = (dir) => git(dir, 'status', '--porcelain').out !== '';
const COMMIT_FIRST = 'el árbol de trabajo tiene cambios sin commit: haz antes el commit o guárdalos (git stash)';

// En un contenedor efímero, start, switch y origin no actúan (design D7 de
// allow-user-requested-merges, ADR-0016): se comprueba antes que nada
const SESSION_ONLY = 'En un contenedor efímero el agente trabaja solo en la rama de la sesión: sigue en la rama de la sesión y, si hace falta otra rama, pídesela al usuario.';

// Crea la rama temporal de un change desde la rama de origen y cambia a ella
export function startBranch(dir, name, env = process.env) {
  if (isEphemeral(env)) return { ok: false, message: `No se crea la rama '${name ?? ''}'. ${SESSION_ONLY}` };
  const { permanent } = readPermanent(dir);
  const origin = permanent.at(-1);
  if (!name || !KEBAB.test(name)) return { ok: false, message: `El nombre del change tiene que ser kebab-case ('${name ?? ''}').` };
  if (permanent.includes(name)) return { ok: false, message: `'${name}' es una rama permanente.` };
  if (dirty(dir)) return { ok: false, message: `No se crea la rama '${name}': ${COMMIT_FIRST}.` };
  if (git(dir, 'rev-parse', '--verify', '-q', `refs/heads/${name}`).ok) return { ok: false, message: `La rama '${name}' ya existe: cambia a ella con 'switch ${name}'.` };
  const ref = originRef(dir, origin);
  if (!ref) return { ok: false, message: `No se encuentra la rama de origen '${origin}' (ni local ni en origin).` };
  const created = spawnSync('git', ['switch', '-q', '-c', name, ref.replace(/^refs\/(heads|remotes)\//, '')], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  if (created.status !== 0) return { ok: false, message: `git switch ha fallado: ${(created.stderr ?? '').trim()}` };
  if (ref.startsWith('refs/remotes/')) git(dir, 'branch', '-q', '--unset-upstream');
  return { ok: true, message: `Creada la rama temporal '${name}' desde '${origin}'; el clon está en ella.` };
}

// Cambia a una rama temporal que ya existe
export function switchBranch(dir, name, env = process.env) {
  if (isEphemeral(env)) return { ok: false, message: `No se cambia a la rama '${name ?? ''}'. ${SESSION_ONLY}` };
  const { permanent } = readPermanent(dir);
  if (!name) return { ok: false, message: 'Falta el nombre de la rama.' };
  if (permanent.includes(name)) return { ok: false, message: `'${name}' es una rama permanente: el change se trabaja en una rama temporal.` };
  if (!git(dir, 'rev-parse', '--verify', '-q', `refs/heads/${name}`).ok) return { ok: false, message: `La rama '${name}' no existe: créala con 'start <change>'.` };
  if (dirty(dir)) return { ok: false, message: `No se cambia a '${name}': ${COMMIT_FIRST}.` };
  const switched = spawnSync('git', ['switch', '-q', name], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  if (switched.status !== 0) return { ok: false, message: `git switch ha fallado: ${(switched.stderr ?? '').trim()}` };
  return { ok: true, message: `El clon está en la rama temporal '${name}'.` };
}

// Vuelve a la rama de origen (la última de `x-main`) con el árbol limpio
export function originBranch(dir, env = process.env) {
  if (isEphemeral(env)) return { ok: false, message: `No se vuelve a la rama de origen. ${SESSION_ONLY}` };
  const { permanent } = readPermanent(dir);
  const origin = permanent.at(-1);
  const current = git(dir, 'symbolic-ref', '--short', '-q', 'HEAD').out;
  if (current === origin) return { ok: true, message: `El clon ya está en la rama de origen '${origin}'.` };
  if (dirty(dir)) return { ok: false, message: `No se vuelve a la rama de origen '${origin}': ${COMMIT_FIRST}.` };
  const hasLocal = git(dir, 'rev-parse', '--verify', '-q', `refs/heads/${origin}`).ok;
  const hasRemote = git(dir, 'rev-parse', '--verify', '-q', `refs/remotes/origin/${origin}`).ok;
  if (!hasLocal && !hasRemote) return { ok: false, message: `No se encuentra la rama de origen '${origin}' (ni local ni en origin).` };
  const args = hasLocal ? ['switch', '-q', origin] : ['switch', '-q', '-c', origin, `origin/${origin}`];
  const switched = spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 });
  if (switched.status !== 0) return { ok: false, message: `git switch ha fallado: ${(switched.stderr ?? '').trim()}` };
  return { ok: true, message: `El clon está en la rama de origen '${origin}'.` };
}

function main(argv) {
  const dir = process.cwd();
  if (argv[0] === 'env') {
    process.stdout.write(`ephemeral=${isEphemeral()}\npermanent=${readPermanent(dir).permanent.join(' ')}\n`);
    return 0;
  }
  if (argv[0] === 'start' || argv[0] === 'switch' || argv[0] === 'origin') {
    const result = argv[0] === 'start' ? startBranch(dir, argv[1]) : argv[0] === 'switch' ? switchBranch(dir, argv[1]) : originBranch(dir);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : 1;
  }
  if (argv[0] === 'merge-targets') {
    const result = mergeTargets(dir);
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      for (const t of result.targets) process.stdout.write(`${t.branch}${t.bringFirst ? `\t(trae antes origin/${t.branch})` : ''}\n`);
      for (const w of result.warnings) process.stderr.write(`aviso: ${w}\n`);
    }
    return 0;
  }
  if (argv[0] === 'list') {
    const branches = listBranches(dir);
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(branches, null, 2)}\n`);
    else for (const b of branches) process.stdout.write(`${b.current ? '*' : ' '} ${b.branch}\t${b.change ?? (b.kind === 'none' ? '(sin change)' : `(${b.kind})`)}\n`);
    return 0;
  }
  if (argv[0] === 'check') {
    const result = check(dir, argv[1], argv[2], { source: argv[3] ?? null });
    const out = { ok: result.ok, message: result.message, ...(result.warning ? { warning: result.warning } : {}) };
    process.stdout.write(`${JSON.stringify(out)}\n`);
    return result.ok ? 0 : 1;
  }
  const state = branchChange(dir);
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  else {
    process.stdout.write(`${state.kind}${state.change ? ` ${state.change}` : ''}\n`);
    for (const warning of state.warnings) process.stderr.write(`aviso: ${warning}\n`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
