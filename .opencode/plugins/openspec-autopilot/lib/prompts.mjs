// Los textos del plugin (design D6, D8, D9, D10 y D13 de
// autopilot-sesion-operativa; D1 y D3 de autopilot-plan-explore; D1 y D2 de
// guiar-revision-con-tests): la instrucción con la que arranca cada paso, el
// recordatorio de cada petición, lo que se inyecta al cambiar entre build y
// plan, el aviso de lo modificado con plan, el aviso de las sesiones ajenas,
// la verificación guiada con los tests de aceptación y la depuración en la
// revisión de una task y del verify, y el workflow y el agente de cada paso
// (siempre build). Ningún texto pide commits: el plugin
// pasa el producto al stage y el usuario hace el commit (ADR-0013).

import { describe } from './next-step.mjs';

export const HANDOFF_TOOL = 'openspec_handoff';
export const SESSION_TOOL = 'openspec_session';
export const MARK = '[openspec-autopilot]';
export const START_WORD = 'autopilot';

// Workflow (skill) y agente de cada paso
export const WORKFLOW = {
  new: { skill: 'openspec-new-change', agent: 'build' },
  artifact: { skill: 'openspec-continue-change', agent: 'build' },
  task: { skill: 'openspec-apply-change', agent: 'build' },
  verify: { skill: 'openspec-verify-change', agent: 'build' },
  archive: { skill: 'openspec-archive-change', agent: 'build' },
  wiki: { skill: null, agent: 'build' },
  update: { skill: 'openspec-update-change', agent: 'build' },
  review: { skill: null, agent: 'build' },
};

// El comando con el que el usuario retoma un paso a mano (tras compactar)
export function resumeCommand(step, change) {
  const skill = WORKFLOW[step?.kind]?.skill;
  if (!skill) return null;
  return `/${skill}${change ? ` ${change}` : ''}`;
}

const GIT =
  'No hagas commits, no pases nada al stage (`git add`) y no pidas commits al usuario: cuando termines, el plugin pasa lo producido al stage y el usuario lo revisa y hace el commit.';

const LESSONS =
  `Si en este paso has comprobado algo, o el usuario te ha corregido algo, que servirá en otra ocasión, pásalo en \`lessons\` al llamar a \`${HANDOFF_TOOL}\` (una frase por lección). ` +
  'Las lecciones no se escriben en el repositorio: se registran en el wiki al archivar el change, si el usuario las confirma.';

const CLOSE = (what) =>
  `Cuando ${what}, llama a la tool \`${HANDOFF_TOOL}\` una sola vez y termina tu respuesta: el plugin comprueba lo producido y sigue. ` +
  `Si el workflow te hace una pregunta para el usuario, házsela y espera. No escribas el archivo de un artefacto hasta tenerlo completo. ${GIT} ${LESSONS}`;

const HEADER = (change) => `${MARK} Esta sesión es la sesión operativa del change${change ? ` \`${change}\`` : ' de esta rama'} y hace un solo paso del ciclo.`;

export function stepPrompt({ step, change, description = '', conclusions = '', index = '', lessons = [], review = null }) {
  const header = HEADER(change);
  switch (step.kind) {
    case 'new':
      return (
        `${header}\n\nUsa la skill \`openspec-new-change\` para crear el change de esta rama. ` +
        (description ? `Descripción del usuario:\n\n${description}\n\n` : 'Pregunta al usuario qué quiere construir o arreglar, y espera su respuesta. ') +
        'Si la rama es permanente o ya tiene otro change, no crees la rama con git: ejecuta `node .agents/openspec/branch-change.mjs start <nombre-del-change>`, que la crea desde la rama de origen y cambia a ella (y `node .agents/openspec/branch-change.mjs list` para ver las ramas temporales con su change). ' +
        `Crea solo el change, sin artefactos. ${CLOSE('el change exista en `openspec/changes/`')}`
      );
    case 'artifact':
      return (
        `${header}\n\nUsa la skill \`openspec-continue-change\` para crear el artefacto \`${step.id}\` de \`${change}\`, y solo ese. ` +
        (description ? `Lo que el usuario pidió al crear el change:\n\n${description}\n\n` : '') +
        CLOSE(`el artefacto \`${step.id}\` esté escrito`)
      );
    case 'task':
      return `${header}\n\nUsa la skill \`openspec-apply-change\` para implementar solo la task ${step.label ?? step.id} de \`${change}\`, y márcala en su \`tasks.md\` al terminarla. No empieces la task siguiente. ${CLOSE(`la task ${step.label ?? step.id} esté implementada y marcada`)}`;
    case 'verify':
      return (
        `${header}\n\nUsa la skill \`openspec-verify-change\` para verificar \`${change}\`. No cambies ningún archivo. Al terminar el informe, llama a la tool \`${HANDOFF_TOOL}\` con \`result: "critical"\` si hay algún problema CRITICAL, o \`result: "clean"\` si no hay ninguno, y con un resumen del informe en \`conclusions\`. ${GIT} ${LESSONS}`
      );
    case 'archive':
      return `${header}\n\nUsa la skill \`openspec-archive-change\` para archivar \`${change}\` en esta rama temporal, sin la resincronización del wiki, que va en el paso siguiente. ${CLOSE('el change esté archivado')}`;
    case 'wiki': {
      const list = lessons.length > 0 ? lessons.map((l) => `- ${l}`).join('\n') : '- (ninguna)';
      return (
        `${header}\n\nSigue las indicaciones de archivado de \`openspec/config.yaml\` para resincronizar el wiki con lo que tocó \`${change}\`, en esta rama y después del commit del archive. ` +
        `En el paso de las lecciones aprendidas, parte de estas lecciones candidatas, que dejaron las sesiones del change. Preséntalas al usuario con lo demás que propongan las indicaciones y registra solo las que confirme:\n\n${list}\n\n` +
        `${CLOSE('termines')}`
      );
    }
    case 'update':
      return (
        `${header}\n\nUsa la skill \`openspec-update-change\` para revisar el plan de \`${change}\` con las conclusiones de la revisión que no fue satisfactoria:\n\n${conclusions || '(sin conclusiones)'}\n\n` +
        'Los cambios que el usuario sacó del stage siguen en el árbol de trabajo: son material de la revisión. ' +
        `Índice de las sesiones del change (sin transcripciones; pide el contenido de una con la tool \`${SESSION_TOOL}\` si lo necesitas):\n\n${index}\n\n${CLOSE('el plan esté actualizado')}`
      );
    case 'review':
      return reviewPrompt({ step, change, review });
    default:
      return header;
  }
}

const WHAT = (step) =>
  ({ artifact: `el artefacto \`${step.id}\``, task: `la task ${step.label ?? step.id}`, verify: 'el informe del verify', plan: 'los cambios en el plan' })[step.of] ?? step.id;

// La verificación guiada de lo que es código: una task o el verify (design D1 y
// D2 de guiar-revision-con-tests), con el MCP de depuración si la sesión lo
// tiene (design D13 de limite-de-verificacion-y-mcp-de-depuracion). El plugin
// no ejecuta nada: lo hace el modelo, y la depuración, el usuario.
const ACCEPTANCE = (step, change) =>
  `Guía la verificación con los escenarios de aceptación del change: en las specs de \`openspec/changes/${change}/specs/\`, ${step.of === 'verify' ? 'toma todos los del change' : `localiza los que cubren ${WHAT(step)}`}, recórrelos con el usuario como guion de lo que hay que comprobar y ejecútalos con el runner de aceptación del proyecto (el que documente su suite)${step.of === 'verify' ? '' : ', solo esos'}; explica qué pasa y qué falla. ` +
  'Haz que las ejecuciones no dejen en el árbol de trabajo archivos que git no ignore, porque la revisión la cierra git. ' +
  'Si lo revisado incluye código fuente que se puede ejecutar, ofrece al usuario depurarlo y dile dónde le conviene poner los puntos de ruptura. ' +
  'Si la sesión tiene un MCP de depuración (las tools `debug_targets` y `debug_launch_plan`, con el prefijo de su servidor o dentro de Code Mode), úsalo: pregunta a `debug_targets` por los archivos revisados y, si da algún objetivo y el usuario quiere depurar, pide a `debug_launch_plan` el plan con esos puntos de ruptura y con los escenarios que ejercitan el código. ' +
  'Enseña el plan al usuario antes de ejecutar ningún paso. Después sigue los pasos en orden: ejecuta tú solo los de `agent`, y los de `user` díselos al usuario, que es quien arranca lo que se queda en marcha y quien depura. ' +
  'Si un IDE o un objetivo trae problemas, díselos con su arreglo, sin arreglarlos tú. Cuando el usuario termine de depurar, sigue igual los pasos de `cleanup`. ' +
  'Si la sesión no lo tiene, o no da ningún objetivo para lo revisado, ofrécele ejecutarlo en modo depuración: dale la orden exacta para lanzarlo con el depurador del stack del proyecto (por ejemplo, el escenario de aceptación que lo ejercita, bajo `node --inspect-brk` en JavaScript o `python -m debugpy --wait-for-client` en Python). Esa orden la ejecuta el usuario en su terminal, no tú: se queda esperando al depurador.';

// La estimación de verificación de una task y el límite del proyecto (design D4
// de limite-de-verificacion-y-mcp-de-depuracion): el modelo los lee de los
// archivos; el plugin no calcula nada.
const ESTIMATE =
  'Empieza por decir al usuario cuánto se estimó que lleva verificar esta task (la estimación del final de su línea en `tasks.md`) y cuál es el límite del proyecto (la regla de `rules.tasks` de `openspec/config.yaml`). ' +
  'Si lo que hay que verificar los supera con claridad, avísale: puede rechazar la revisión para que la task se divida.';

export function reviewPrompt({ step, change, review = null }) {
  const errors = review?.errors?.length ? `\n\n\`openspec validate\` da estos errores en el change; señálalos en la revisión:\n\n${review.errors.map((e) => `- ${e}`).join('\n')}` : '';
  const verify = step.of === 'verify' && review?.report ? `\n\nInforme del verify:\n\n${review.report}` : '';
  const staged =
    step.of === 'verify'
      ? 'Para darla por buena, el usuario hace un commit (vacío si no hay nada que cambiar: `git commit --allow-empty`); para rechazarla, deja cambios fuera del stage con sus conclusiones.'
      : 'Lo que hay que revisar está en el stage de git (`git diff --cached`). Para darla por buena, el usuario hace el commit; para rechazarla, lo saca del stage (`git restore --staged .`) y escribe sus conclusiones.';
  return (
    `${MARK} Esta sesión es la revisión humana ${`de ${WHAT(step)}`.replace(/^de el /, 'del ')} de \`${change}\`. No modifiques ningún archivo, no hagas commits y no pidas commits.${errors}${verify}\n\n` +
    `Guía al usuario por la revisión: resume lo que hay que mirar, señala lo dudoso y responde a sus preguntas.${step.of === 'task' ? ` ${ESTIMATE}` : ''}${step.of === 'task' || step.of === 'verify' ? ` ${ACCEPTANCE(step, change)}` : ''} ${staged} ` +
    `La revisión la cierra git cuando el usuario envía su siguiente mensaje, no tú. Si das tus conclusiones, pásalas con \`${HANDOFF_TOOL}\` en \`conclusions\`. ${LESSONS}`
  );
}

// Lo que se recuerda en cada petición de la sesión operativa (design D6)
export function reminderPrompt({ step, change, phase }) {
  if (phase === 'waiting-commit') {
    return `${MARK} Esta sesión es la sesión operativa de ${describe(step, change)}, pero está esperando a que el usuario haga el commit de los cambios pendientes. No empieces el paso ni cambies archivos; el paso empezará con el árbol limpio.`;
  }
  if (step?.kind === 'review') return `${MARK} Recordatorio: esta sesión es la ${describe(step, change)}. No modifiques archivos ni pidas commits: la revisión la cierra git.`;
  return `${MARK} Recordatorio: esta sesión hace solo el paso «${describe(step, change)}». No empieces el paso siguiente. ${GIT} Al terminar, llama a \`${HANDOFF_TOOL}\`.`;
}

// Lo que recibe el modelo al cambiar de agente en la sesión operativa (design
// D3 de autopilot-plan-explore, ADR-0019). Ninguno queda en el historial: los
// inyecta el hook context en cada petición del turno.

const WHERE = (step, change) => (step?.kind === 'review' ? `la ${describe(step, change)}` : `el paso «${describe(step, change)}»`);

// Al pasar de build a plan: el flujo completo de exploración
export function explorePrompt({ step, change }) {
  return (
    `${MARK} El usuario ha pasado al agente plan para explorar ${WHERE(step, change)}. ` +
    'Usa la skill `openspec-explore`: sé su compañero de pensamiento, investiga, compara alternativas y aclara dudas sobre el change y este paso, sin implementar nada y sin escribir artefactos ni código. ' +
    `No llames a \`${HANDOFF_TOOL}\`: explorar no cierra el paso. ` +
    'Si el usuario te pide expresamente modificar archivos, recuérdale que eso es del agente build (Shift+Tab) y que, si lo haces aquí, el plugin le avisará antes de seguir con el ciclo.'
  );
}

// Las peticiones siguientes con el agente plan
export function exploreReminderPrompt({ step, change }) {
  return `${MARK} Recordatorio: estás explorando ${WHERE(step, change)} con el agente plan y la skill \`openspec-explore\`. No implementes ni modifiques archivos.`;
}

// Al volver de plan a build: solo el recordatorio de lo que había antes
export function returnPrompt({ step, change, phase }) {
  const reminder = reminderPrompt({ step, change, phase }).replace(`${MARK} `, '').replace(/^Recordatorio: /, '');
  return `${MARK} Vuelves de explorar con el agente plan; sigue con lo que había antes. ${reminder.charAt(0).toUpperCase()}${reminder.slice(1)}`;
}

// El aviso de lo modificado con el agente plan (design D5), sin prefijo: lo
// que llega al modelo ya lleva la marca, y el modal antepone el nombre del plugin
export function planNoticeText() {
  return (
    'Con el agente plan se han hecho modificaciones en el repositorio que, por el enfoque del workflow y la naturaleza del agente plan, deberían haberse reservado al agente build. ' +
    'Normalmente es porque se le ha pedido expresamente. Revisa los cambios (`git status`) antes de seguir.'
  );
}

// Lo que recibe el modelo en una sesión que no es la operativa (design D13)
export function foreignPrompt({ change, title, sessionID }) {
  return (
    `${MARK} Esta sesión no es la sesión operativa. Mientras se edita ${change ? `el change \`${change}\`` : 'un change nuevo'} en modo autopilot, solo se opera con su sesión operativa «${title}» (${sessionID}). ` +
    'No cambies archivos ni hagas nada del change aquí: di al usuario que vaya a esa sesión.'
  );
}

// Lo que recibe la revisión al cerrarse por git (design D8)
export function closedPrompt(result) {
  return `${MARK} El usuario ha cerrado esta revisión con git (${result === 'ok' ? 'commit: satisfactoria' : 'todo fuera del stage: no satisfactoria'}). No hagas nada más: responde solo «Revisión cerrada.».`;
}
