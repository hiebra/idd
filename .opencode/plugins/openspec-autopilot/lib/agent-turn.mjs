// Qué inyecta el plugin en la sesión operativa según el agente de cada turno
// (design D2 de autopilot-plan-explore, ADR-0019). Funciones puras.
//
// El hook `context` se ejecuta en cada petición al modelo, también en las
// que siguen a una tool dentro del mismo turno, y lo que inyecta no queda en
// el historial: por eso se decide una vez por turno (por mensaje del usuario)
// y se repite en todas las peticiones del turno.
//
// - turnKey(messages, { turnMessage, previous }): la clave del turno. Es el
//   último `messageID` que guardó el hook `prompt` (`turnMessage`), desde la
//   primera petición que lleva ese mensaje (con ese `id`); hasta entonces, la
//   clave anterior. Un mensaje que entra a mitad de turno (OpenCode lo mete en
//   el mismo bucle, task 1.4) cambia la clave en la primera petición en la que
//   el modelo lo ve. Lo que OpenCode u otros plugins insertan (el recordatorio
//   del agente plan, los de session-bootstrap) no pasa por el hook `prompt` y
//   no la cambia.
// - transition(previo, actual): lo que se inyecta en el turno.
// - agentTurn(guardado, { key, agent }): el estado del turno, y si es nuevo.

export function turnKey(messages, { turnMessage = null, previous = null } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  if (turnMessage && list.some((m) => m?.id === turnMessage)) return turnMessage;
  return previous ?? null;
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
