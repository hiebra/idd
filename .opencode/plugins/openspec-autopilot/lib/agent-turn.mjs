// Qué inyecta el plugin en la sesión operativa según el agente de cada turno
// (design D2 de autopilot-plan-explore, ADR-0019). Funciones puras.
//
// El hook `context` se ejecuta en cada petición al modelo, también en las
// que siguen a una tool dentro del mismo turno, y lo que inyecta no queda en
// el historial: por eso se decide una vez por turno (por mensaje del usuario)
// y se repite en todas las peticiones del turno.
//
// - turnKey(messages): la clave del turno. Es el número de mensajes del
//   modelo (asistente y tools) antes del último mensaje del usuario, con el
//   texto de ese mensaje. No cambia entre las peticiones de un turno, aunque
//   otros hooks inserten sus recordatorios antes del mensaje del usuario, y
//   cambia con cada mensaje nuevo del usuario, también con el mensaje con el
//   que el plugin arranca el paso.
// - transition(previo, actual): lo que se inyecta en el turno.
// - agentTurn(guardado, { key, agent }): el estado del turno, y si es nuevo.

import { createHash } from 'node:crypto';

const textOf = (message) => {
  const content = message?.content;
  if (typeof content === 'string') return content;
  return (Array.isArray(content) ? content : []).map((p) => (p?.type === 'text' ? (p.text ?? '') : '')).join('\n');
};

export function turnKey(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let last = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.role === 'user' && textOf(list[i]).trim() !== '') {
      last = i;
      break;
    }
  }
  if (last < 0) return null;
  const replies = list.slice(0, last).filter((m) => m?.role === 'assistant' || m?.role === 'tool').length;
  const hash = createHash('sha1').update(textOf(list[last])).digest('hex').slice(0, 12);
  return `${replies}:${hash}`;
}

// Un agente ausente o desconocido es build: el plugin se comporta como antes
const normalize = (agent) => (agent === 'plan' ? 'plan' : 'build');

// step: el recordatorio del paso; explore: la instrucción completa de
// openspec-explore; explore-reminder: su recordatorio; return: el
// recordatorio del paso, al volver de explorar
export function transition(previous, agent) {
  const from = normalize(previous);
  const to = normalize(agent);
  if (to === 'plan') return from === 'plan' ? 'explore-reminder' : 'explore';
  return from === 'plan' ? 'return' : 'step';
}

export function agentTurn(stored, { key, agent }) {
  const state = stored && typeof stored === 'object' ? stored : null;
  if (!key || state?.key === key) return { state, fresh: false };
  return { state: { key, agent: normalize(agent), kind: transition(state?.agent, agent) }, fresh: true };
}
