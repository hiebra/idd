// Los textos con los que arranca cada paso (design D6, D8, D9, D10 y D11 de
// add-openspec-autopilot), y el workflow y el agente de cada uno.

export const HANDOFF_TOOL = 'openspec_handoff';
export const SESSION_TOOL = 'openspec_session';

// Workflow (skill) y agente de cada paso (design D6)
export const WORKFLOW = {
  new: { skill: 'openspec-new-change', agent: 'build' },
  artifact: { skill: 'openspec-continue-change', agent: 'build' },
  task: { skill: 'openspec-apply-change', agent: 'build' },
  verify: { skill: 'openspec-verify-change', agent: 'build' },
  archive: { skill: 'openspec-archive-change', agent: 'build' },
  wiki: { skill: null, agent: 'build' },
  update: { skill: 'openspec-update-change', agent: 'build' },
  review: { skill: null, agent: 'plan' },
};

// El comando con el que el usuario retoma un paso a mano (tras compactar)
export function resumeCommand(step, change) {
  const skill = WORKFLOW[step?.kind]?.skill;
  if (!skill) return null;
  return `/${skill}${change ? ` ${change}` : ''}`;
}

const LESSONS =
  `Si en este paso has comprobado algo, o el usuario te ha corregido algo, que servirá en otra ocasión, pásalo en \`lessons\` (una frase por lección); si no, no pases \`lessons\`. ` +
  'Las lecciones no se escriben en el repositorio: se registran en el wiki al archivar el change, si el usuario las confirma.';

const CLOSE = (what) =>
  `Cuando ${what}, pide al usuario el commit de lo que hayas cambiado y llama a la tool \`${HANDOFF_TOOL}\`, solo entonces y una sola vez. ` +
  `Si el workflow te hace una pregunta para el usuario, házsela y espera: no llames a la tool hasta terminar. ${LESSONS}`;

const HEADER = (step, change) =>
  `[openspec-autopilot] Esta sesión tiene el control del change${change ? ` \`${change}\`` : ' de esta rama'} y hace un solo paso del ciclo.`;

export function stepPrompt({ step, change, description = '', conclusions = '', index = '', lessons = [] }) {
  const header = HEADER(step, change);
  switch (step.kind) {
    case 'new':
      return `${header}\n\nUsa la skill \`openspec-new-change\` para crear el change de esta rama a partir de esta descripción del usuario:\n\n${description}\n\n${CLOSE('el change exista en `openspec/changes/`')}`;
    case 'artifact':
      return `${header}\n\nUsa la skill \`openspec-continue-change\` para crear el artefacto \`${step.id}\` de \`${change}\`, y solo ese. ${CLOSE(`el artefacto \`${step.id}\` esté escrito`)}`;
    case 'task':
      return `${header}\n\nUsa la skill \`openspec-apply-change\` para implementar solo la task ${step.id} de \`${change}\`, y márcala en su \`tasks.md\` al terminarla. No empieces la task siguiente. ${CLOSE(`la task ${step.id} esté implementada y marcada`)}`;
    case 'verify':
      return (
        `${header}\n\nUsa la skill \`openspec-verify-change\` para verificar \`${change}\`. Al terminar el informe, llama a la tool \`${HANDOFF_TOOL}\` con \`result: "critical"\` si hay algún problema CRITICAL, o \`result: "clean"\` si no hay ninguno, y con un resumen del informe en \`conclusions\`. ${LESSONS}`
      );
    case 'archive':
      return `${header}\n\nUsa la skill \`openspec-archive-change\` para archivar \`${change}\` en esta rama temporal, sin la resincronización del wiki, que va en el paso siguiente. ${CLOSE('el change esté archivado')}`;
    case 'wiki': {
      const list = lessons.length > 0 ? lessons.map((l) => `- ${l}`).join('\n') : '- (ninguna)';
      return (
        `${header}\n\nSigue las indicaciones de archivado de \`openspec/config.yaml\` para resincronizar el wiki con lo que tocó \`${change}\`, en esta rama y después del commit del archive. ` +
        `En el paso de las lecciones aprendidas, parte de estas lecciones candidatas, que dejaron las sesiones del change. Preséntalas al usuario con lo demás que propongan las indicaciones y registra solo las que confirme:\n\n${list}\n\n` +
        `Cuando termines, pide al usuario el commit del wiki, aparte del commit del archive, y llama a la tool \`${HANDOFF_TOOL}\`.`
      );
    }
    case 'update':
      return (
        `${header}\n\nUsa la skill \`openspec-update-change\` para revisar el plan de \`${change}\` con las conclusiones de la revisión que no fue satisfactoria:\n\n${conclusions || '(sin conclusiones)'}\n\n` +
        `Índice de las sesiones del change (sin transcripciones; pide el contenido de una con la tool \`${SESSION_TOOL}\` si lo necesitas):\n\n${index}\n\n${CLOSE('el plan esté actualizado')}`
      );
    case 'review':
      return reviewPrompt({ step, change });
    default:
      return header;
  }
}

export function reviewPrompt({ step, change }) {
  const what = { artifact: `el artefacto \`${step.id}\``, task: `la task ${step.id}`, verify: 'el informe del verify', plan: 'los cambios en el plan' }[step.of] ?? step.id;
  return (
    `[openspec-autopilot] Esta sesión es la revisión humana de ${what} de \`${change}\`. No modifiques ningún archivo.\n\n` +
    `Guía al usuario por la revisión: resume lo que hay que mirar, señala lo dudoso y responde a sus preguntas. ` +
    `Solo cuando el usuario dé la revisión por terminada, llama a la tool \`${HANDOFF_TOOL}\` con \`result: "ok"\` si es satisfactoria o \`result: "no ok"\` si no lo es, y en ese caso con sus conclusiones en \`conclusions\`. ` +
    `Un aplazamiento ("lo miro luego") no la termina. El usuario tendrá que confirmar el cierre. ${LESSONS}`
  );
}

// Lo que se inyecta mientras el árbol de trabajo no está limpio (design D11)
export function commitPrompt({ step, change }) {
  return (
    `[openspec-autopilot] Esta sesión tiene el control del change${change ? ` \`${change}\`` : ''}, pero el árbol de trabajo tiene cambios sin commit. ` +
    'No empieces el paso: pide al usuario que haga el commit y espera. El paso empezará en el siguiente mensaje con el árbol limpio.'
  );
}
