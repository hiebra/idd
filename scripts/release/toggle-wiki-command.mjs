// El comando /toggle-wiki de la instalación global (task 7.5 de
// windows-global-distro). Sale del de OpenCode del proyecto,
// .opencode/commands/toggle-wiki.md, con lo que cambia en la instalación global:
//
// - las órdenes llaman al núcleo del arranque instalado con el plugin
//   session-bootstrap, en modo global (`node <script> --global wiki …`);
// - la ruta del núcleo va en una sola línea, «El script es: …», que escribe el
//   .bat con la ruta absoluta, como en el SKILL.md de openspec-git-discipline
//   (design D4). El texto es el mismo y solo ASCII, porque el .bat lo escribe
//   con echo;
// - la skill wiki-manager está instalada de forma global, y el helper del
//   motor se encuentra con la ruta `wiki-engine=` que da `wiki on`;
// - las skills del wiki no llegan ni se van con el ajuste: las instala siempre
//   la instalación global.
//
// globalPieces(texto) devuelve { head, tail }: lo que va antes de esa línea y lo
// que va después de su salto de línea, que pone quien la escribe. Si el
// comando del proyecto ha cambiado y algún texto no está, falla, para que la
// release no lleve un comando a medio adaptar.
// Sin dependencias: lo usan build.mjs y la suite.

export const COMMAND = '.opencode/commands/toggle-wiki.md';
export const CORE_LINE = /^El script es: `([^`]+)`$/m;

const FIRST_STEP = '<!-- toggle-wiki:status -->';
const CALL = 'node .agents/hooks/session-bootstrap.mjs wiki ';
const GLOBAL_CALL = 'node <script> --global wiki ';

const INTRO =
  'En la instalación global, la parte determinista la hace el núcleo del arranque, instalado con el plugin `session-bootstrap`. ' +
  'En las órdenes de este comando, `<script>` es su ruta, entre comillas si tiene espacios.';

// Lo que cambia en la instalación global; cada texto tiene que estar una sola vez
const REPLACEMENTS = [
  ['Habilita el wiki, que instala y expone el motor:', 'Habilita el wiki, que expone el motor de la instalación global:'],
  [
    'En esta sesión aún no la verás: lee sus instrucciones de `.agents/wiki-engine/claude-plugin/skills/wiki-manager/SKILL.md` y síguelas. Si `$CLAUDE_PLUGIN_ROOT` está vacía, usa `CLAUDE_PLUGIN_ROOT="$PWD/.agents/wiki-engine/claude-plugin"` para el helper del motor.',
    'Está instalada de forma global, así que ya la tienes en esta sesión. Si `$CLAUDE_PLUGIN_ROOT` está vacía, usa como `CLAUDE_PLUGIN_ROOT` la ruta de la línea `wiki-engine=` que ha impreso `wiki on`, para el helper del motor.',
  ],
  ['Las skills `wiki-query` y `wiki-manager`, la guía y el recordatorio del wiki llegan desde la sesión siguiente', 'La guía y el recordatorio del wiki llegan desde la sesión siguiente'],
  [', y las skills del wiki desaparecen, a más tardar, en la sesión siguiente.', '.'],
];

export function coreLine(core) {
  return `El script es: \`${core}\``;
}

export function globalPieces(text) {
  let out = text.replace(/\r\n/g, '\n');
  const fail = (what) => {
    throw new Error(`${COMMAND} ya no tiene ${what}: revisa scripts/release/toggle-wiki-command.mjs`);
  };
  if (!out.includes(CALL)) fail(`«${CALL.trim()}»`);
  out = out.replaceAll(CALL, GLOBAL_CALL);
  for (const [from, to] of REPLACEMENTS) {
    if (out.split(from).length !== 2) fail(`una sola vez «${from}»`);
    out = out.replace(from, to);
  }
  const at = out.indexOf(FIRST_STEP);
  if (at < 0) fail(FIRST_STEP);
  return { head: `${out.slice(0, at)}${INTRO}\n\n`, tail: `\n${out.slice(at)}` };
}

// El comando entero, con la ruta del núcleo
export function globalCommand(text, core) {
  const { head, tail } = globalPieces(text);
  return `${head}${coreLine(core)}\n${tail}`;
}
