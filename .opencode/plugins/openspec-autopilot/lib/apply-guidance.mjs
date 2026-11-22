// Las indicaciones de apply de «una task por sesión» según el modo (design
// D1 a D4 de apply-one-task-per-session-in-normal-mode, ADR-0025): en el modo
// normal, `openspec/config.yaml` las lleva en `operations.apply.guidance`; en el
// modo auto, no. Se edita el texto por líneas, sin parser de YAML, para no
// tocar nada más del archivo (comentarios y formato incluidos): el bloque se
// reconoce por su texto canónico, el de la spec.
//
// adjust(text, mode) es pura y se prueba con node --test; syncApplyGuidance
// lee y escribe el archivo, y nunca lanza.

import fs from 'node:fs/promises';
import path from 'node:path';

const ITEMS = [
  [
    'Standing instruction from the project owner: apply runs one tracked',
    'task per session. Take it as given that the user interrupts after every',
    'completed task; this is the built-in "User interrupts" pause, declared',
    'in advance. So in this session the task to work on is the first one the',
    'CLI returns with `done: false`.',
  ],
  [
    'Implement that task in this top-level interactive session. Do not',
    'delegate it to a subagent or any other non-interactive agent, so that',
    'every built-in pause (unclear task, design issue, added scope, error or',
    'blocker) is asked to the user and answered in this session.',
  ],
  [
    'When the task is marked `- [x]` and the rerun of the apply instructions',
    'confirms it, that pause applies: go to the built-in "On completion or',
    'pause, show status" step instead of continuing to the next task. Show',
    'it as completion if the CLI now reports `all_done`; otherwise as a',
    'pause whose reason is the session boundary and whose way forward is a',
    'new session (fresh context) running this same apply workflow for this',
    'change. The built-in loop resumes there from the first pending task, as',
    'any resumed apply does.',
  ],
  [
    'Change nothing else. Steps, CLI commands, checkbox updates, pause',
    'conditions, status and completion output, and completion criteria stay',
    'exactly as the built-in workflow defines them, so the change ends up as',
    'a single uninterrupted apply would leave it. Add nothing on account of',
    'the session split: no handoff or progress files, no notes or markers in',
    'the tracking file, no extra commits. This guidance applies only while',
    'implementing tasks, not to verification or any other workflow that',
    'reads this output.',
  ],
];

// Las líneas del bloque, con la sangría de `operations.apply.guidance` (2 espacios por nivel)
export const BLOCK = ITEMS.flatMap((item) => ['      - >-', ...item.map((l) => `        ${l}`)]);

// El inicio de la primera indicación, para avisar de un bloque reformateado a mano
const FIRST_WORDS = 'Standing instruction from the project owner';

export const CONFIG_PATH = path.join('openspec', 'config.yaml');

const indentOf = (line) => /^ */.exec(line)[0].length;
const blank = (line) => line.trim() === '';
const comment = (line) => line.trim().startsWith('#');
const content = (line) => !blank(line) && !comment(line);
const keyLine = (indent, key) => new RegExp(`^ {${indent}}${key}:\\s*(#.*)?$`);

// La sección de una clave: [desde la línea de la clave, hasta antes de la primera
// línea con contenido a su nivel o menos]. Una lista al mismo nivel que la clave
// («guidance:\n    - x») también es suya.
function section(lines, from, to, indent, key) {
  const re = keyLine(indent, key);
  for (let i = from; i < to; i++) {
    if (!re.test(lines[i])) continue;
    let end = i + 1;
    while (end < to) {
      const line = lines[end];
      if (!blank(line)) {
        const n = indentOf(line);
        const ownList = n === indent && line.slice(n).startsWith('- ');
        if (n < indent || (n === indent && !ownList)) break;
        if (n === 0 && comment(line)) break;
      }
      end++;
    }
    return { start: i, end };
  }
  return null;
}

// La última línea con contenido de una sección (o la de la clave)
function lastContent(lines, sec) {
  for (let i = sec.end - 1; i > sec.start; i--) if (!blank(lines[i])) return i;
  return sec.start;
}

const hasContent = (lines, sec) => lines.slice(sec.start + 1, sec.end).some(content);

function findBlock(lines, sec) {
  for (let i = sec.start + 1; i + BLOCK.length <= sec.end; i++) {
    if (BLOCK.every((l, k) => lines[i + k] === l)) return i;
  }
  return -1;
}

function locate(lines) {
  const ops = section(lines, 0, lines.length, 0, 'operations');
  const apply = ops && section(lines, ops.start + 1, ops.end, 2, 'apply');
  const guidance = apply && section(lines, apply.start + 1, apply.end, 4, 'guidance');
  return { ops, apply, guidance };
}

// adjust(text, mode) -> { text, changed, similar }
//   mode: "normal" (las indicaciones están) | "auto" (no están)
//   similar: hay un texto parecido a la primera indicación que no es el bloque canónico
export function adjust(text, mode) {
  const original = String(text ?? '');
  const lines = original.split('\n');
  const { ops, apply, guidance } = locate(lines);
  const at = guidance ? findBlock(lines, guidance) : -1;
  const present = at >= 0;
  const similar = !present && original.includes(FIRST_WORDS);

  if (mode === 'auto') {
    if (!present) return { text: original, changed: false, similar };
    lines.splice(at, BLOCK.length);
    // Poda las claves que quedan vacías, de dentro afuera
    for (const key of ['guidance', 'apply', 'operations']) {
      const sec = locate(lines)[{ guidance: 'guidance', apply: 'apply', operations: 'ops' }[key]];
      if (sec && !hasContent(lines, sec)) lines.splice(sec.start, 1);
      else break;
    }
    return { text: lines.join('\n'), changed: true, similar: false };
  }

  if (present) return { text: original, changed: false, similar: false };
  if (guidance) {
    lines.splice(lastContent(lines, guidance) + 1, 0, ...BLOCK);
  } else if (apply) {
    lines.splice(apply.start + 1, 0, '    guidance:', ...BLOCK);
  } else if (ops) {
    lines.splice(ops.start + 1, 0, '  apply:', '    guidance:', ...BLOCK);
  } else {
    // Al final del archivo, antes del salto de línea final si lo hay
    const tail = lines.length > 0 && lines.at(-1) === '' ? lines.length - 1 : lines.length;
    lines.splice(tail, 0, 'operations:', '  apply:', '    guidance:', ...BLOCK);
  }
  return { text: lines.join('\n'), changed: true, similar };
}

// syncApplyGuidance(directory, mode) -> { written, missing, similar, error }
//   Lee `openspec/config.yaml` del directorio, lo ajusta al modo y lo escribe
//   solo si cambia. Sin el archivo no hace nada (no lo crea). Nunca lanza: un
//   fallo de lectura o escritura vuelve en `error`.
export async function syncApplyGuidance(directory, mode) {
  const file = path.join(directory, CONFIG_PATH);
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { written: false, missing: true, similar: false, error: null };
    return { written: false, missing: false, similar: false, error };
  }
  const out = adjust(text, mode);
  if (!out.changed) return { written: false, missing: false, similar: out.similar, error: null };
  try {
    await fs.writeFile(file, out.text, 'utf8');
  } catch (error) {
    return { written: false, missing: false, similar: out.similar, error };
  }
  return { written: true, missing: false, similar: out.similar, error: null };
}
