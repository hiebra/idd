// Parte de TUI del plugin openspec-autopilot para OpenCode 2 (design D3 y D13
// de add-openspec-autopilot): hace lo que solo se puede hacer desde la TUI,
// a petición del servidor (server.js) por el RPC del plugin: avisos (toasts),
// navegar a una sesión, archivarla con el cliente de la TUI (el ctx.session
// del servidor no archiva, lección 1) y los diálogos de selección.
//
// Cada carga es una instancia con su identificador, y solo atiende las
// peticiones dirigidas a ella (D13). Al descargarse (antes de cada recarga en
// caliente y al cerrar), se da de baja de los eventos con la función que
// devuelve setup (ADR-0010): sin ella seguiría escuchando tras la recarga y,
// con --standalone, dejaría trazas ECONNRESET al cerrar.
//
// Sin dependencias y sin lanzar nunca una excepción hacia OpenCode.

import { RPC } from './lib/rpc.mjs';

const log = (...args) => console.error(`[${RPC.id}]`, ...args);

async function perform(context, op, args) {
  switch (op) {
    case 'toast':
      context.ui.toast.show({ message: String(args?.message ?? ''), variant: args?.variant === 'info' ? 'info' : 'warning' });
      return true;
    case 'navigate':
      context.ui.router.navigate({ type: 'session', sessionID: args.sessionID });
      return true;
    case 'archive':
      await context.client.session.update({ sessionID: args.sessionID, archived: true });
      return true;
    case 'select': {
      const value = await context.ui.dialog.select({ title: String(args?.title ?? ''), options: args?.options ?? [] });
      return value === undefined ? null : value;
    }
    default:
      throw new Error(`petición desconocida '${op}'`);
  }
}

export default {
  id: RPC.id,
  async setup(context) {
    const instance = `tui-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // OpenCode ejecuta lo que devuelve setup antes de cada recarga y al cerrar (ADR-0010)
    const subscriptions = new AbortController();
    const cleanup = () => subscriptions.abort();
    const { signal } = subscriptions;
    try {
      const client = context.client.rpc(RPC);
      const hello = () => Promise.resolve(client.hello({ instance })).catch((error) => log('hello:', error));
      client.events.on('hello-request', () => {
        hello();
      }, { signal });
      client.events.on('request', async (event) => {
        const request = event?.data;
        if (!request || request.instance !== instance) return;
        let value = null;
        let error = null;
        try {
          value = await perform(context, request.op, request.args);
        } catch (e) {
          error = String(e?.message ?? e);
          log(`${request.op}:`, e);
        }
        try {
          await client.reply({ id: request.id, instance, value, error });
        } catch (e) {
          log('reply:', e);
        }
      }, { signal });
      await hello();
    } catch (error) {
      log('rpc:', error);
    }
    return cleanup;
  },
};
