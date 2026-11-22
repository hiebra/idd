// Parte de TUI del plugin openspec-autopilot para OpenCode 2 (ADR-0014;
// design D1, D3, D4 y D14 de autopilot-sesion-operativa): solo interfaz. La
// lógica vive en server.js, que la TUI consulta por el RPC del plugin.
//
// - Se presenta con hello({ instance, pid }): el PID dice al servidor si es un
//   arranque (otro proceso) o una recarga en caliente (el mismo). Cada
//   llamada lleva la ubicación del proyecto: sin ella, en la pantalla de
//   inicio no llega a la parte de servidor (rpc.unavailable). Si aun así el
//   servidor todavía no ha registrado su RPC, lo reintenta sin escribir nada;
//   el servidor la vuelve a pedir con hello-request.
// - Cada 300 ms consulta la pantalla (ui.router.current(), que no tiene
//   evento) y, al cambiar o al recuperar el foco del terminal
//   (renderer "focus"), pregunta al servidor qué hacer (screen).
// - Una ventana ajena muestra un modal de un solo botón; se cierre como se
//   cierre, lleva a la sesión operativa. No se repite en bucle: no se abre
//   otro mientras hay uno, ni otra vez en la misma pantalla hasta que cambie
//   la pantalla o vuelva el foco, ni en la pantalla a la que el servidor
//   acaba de navegar.
// - Atiende las peticiones del servidor: avisos, navegar y archivar con el
//   cliente de la TUI (el del servidor no archiva), y el modal del aviso de lo
//   modificado con el agente plan, que al cerrarse llama a ack (design D5 de
//   autopilot-plan-explore).
//
// Al descargarse (antes de cada recarga y al cerrar), la función que devuelve
// setup da de baja los eventos, para el temporizador y deja de escuchar el
// foco (ADR-0011). Sin dependencias y sin lanzar nunca una excepción hacia OpenCode.

import { HELLO_RETRY_MS, RPC, rpcUnavailable } from './lib/rpc.mjs';

const log = (...args) => console.error(`[${RPC.id}]`, ...args);
const POLL_MS = 300;

const routeKey = (route) => (route?.type === 'session' ? `session:${route.sessionID}` : route?.type ?? 'home');

export default {
  id: RPC.id,
  async setup(context) {
    const instance = `tui-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const subscriptions = new AbortController();
    const { signal } = subscriptions;
    let timer = null;
    let retry = null;
    const renderer = context.renderer;
    let onFocus = null;
    const cleanup = () => {
      subscriptions.abort();
      if (timer) clearInterval(timer);
      if (retry) clearTimeout(retry);
      try {
        if (onFocus) renderer?.off?.('focus', onFocus);
      } catch (error) {
        log('focus:', error);
      }
    };

    try {
      const client = context.client.rpc(RPC);
      // Sin sesión abierta (la pantalla de inicio), una llamada sin ubicación
      // no llega a la parte de servidor del proyecto: rpc.unavailable (D14)
      const at = context.location?.directory ? { location: { directory: context.location.directory } } : undefined;
      let presented = false;
      let lastKey = null;
      let modalOpen = false;
      let shownKey = null;
      let expected = null; // la pantalla a la que el servidor acaba de navegar

      const current = () => {
        try {
          return context.ui.router.current() ?? { type: 'home' };
        } catch {
          return { type: 'home' };
        }
      };

      const go = (sessionID) => {
        expected = `session:${sessionID}`;
        context.ui.router.navigate({ type: 'session', sessionID });
      };

      const showModal = async (d, key) => {
        modalOpen = true;
        shownKey = key;
        try {
          await context.ui.dialog.select({ title: d.message, options: [{ title: d.button ?? 'Ir a la sesión del change', value: 'go' }] });
        } catch (error) {
          log('modal:', error);
        }
        modalOpen = false;
        if (signal.aborted) return;
        // Enter o Esc: los dos llevan a la sesión operativa
        try {
          go(d.sessionID);
        } catch (error) {
          log('navigate:', error);
          context.ui.toast.show({ message: `openspec-autopilot: no se ha podido pasar a la sesión operativa (${error?.message ?? error}).`, variant: 'warning' });
        }
      };

      const showNotice = async (d) => {
        modalOpen = true;
        try {
          await context.ui.dialog.select({ title: d.message, options: [{ title: d.button ?? 'Entendido', value: 'ok' }] });
        } catch (error) {
          log('notice:', error);
        }
        modalOpen = false;
      };

      const report = async (reason) => {
        if (!presented || modalOpen || signal.aborted) return;
        const route = current();
        const key = routeKey(route);
        if (reason === 'route' && key === expected) {
          expected = null;
          return;
        }
        if (reason === 'focus') shownKey = null;
        let d;
        try {
          d = await client.screen({ instance, route, reason }, at);
        } catch (error) {
          if (!rpcUnavailable(error)) log('screen:', error);
          return;
        }
        if (signal.aborted || routeKey(current()) !== key) return;
        if (d?.action === 'modal' && shownKey !== key) await showModal(d, key);
        else if (d?.action === 'notice' && shownKey !== key) {
          shownKey = key;
          await showNotice(d);
        } else if (d?.action === 'navigate' && d.sessionID) go(d.sessionID);
      };

      // El aviso de lo modificado con el agente plan (D5 de autopilot-plan-explore):
      // el modal queda abierto sin hacer esperar al servidor, y al cerrarse, de
      // cualquier forma, el acuse va por la sesión
      const planNotice = (args) => {
        modalOpen = true;
        Promise.resolve()
          .then(() => context.ui.dialog.select({ title: String(args?.message ?? ''), options: [{ title: 'Entendido', value: 'ok' }] }))
          .catch((error) => log('notice:', error))
          .then(async () => {
            modalOpen = false;
            try {
              await client.ack({ instance, sessionID: args?.sessionID }, at);
            } catch (error) {
              log('ack:', error);
            }
          });
      };

      const perform = async (op, args) => {
        switch (op) {
          case 'notice':
            planNotice(args);
            return true;
          case 'toast':
            context.ui.toast.show({ message: String(args?.message ?? ''), variant: args?.variant === 'info' ? 'info' : 'warning' });
            return true;
          case 'navigate':
            go(args.sessionID);
            return true;
          case 'archive':
            await context.client.session.update({ sessionID: args.sessionID, archived: true });
            return true;
          default:
            throw new Error(`petición desconocida '${op}'`);
        }
      };

      const hello = async (attempt = 0) => {
        if (signal.aborted) return;
        try {
          await client.hello({ instance, pid: process.pid, client: 'tui' }, at);
          presented = true;
        } catch (error) {
          if (rpcUnavailable(error) && attempt < HELLO_RETRY_MS.length) {
            // El servidor todavía no ha registrado su RPC: hello-request llegará igual
            retry = setTimeout(() => hello(attempt + 1), HELLO_RETRY_MS[attempt]);
            retry.unref?.();
            return;
          }
          log('hello:', error);
        }
      };

      client.events.on('hello-request', () => {
        hello();
      }, { signal });
      client.events.on('request', async (event) => {
        const request = event?.data;
        if (!request || request.instance !== instance) return;
        let value = null;
        let error = null;
        try {
          value = await perform(request.op, request.args);
        } catch (e) {
          error = String(e?.message ?? e);
          log(`${request.op}:`, e);
        }
        try {
          await client.reply({ id: request.id, instance, value, error }, at);
        } catch (e) {
          log('reply:', e);
        }
      }, { signal });

      onFocus = () => {
        report('focus');
      };
      renderer?.on?.('focus', onFocus);

      await hello();
      timer = setInterval(() => {
        const key = routeKey(current());
        if (key === lastKey) return;
        lastKey = key;
        report('route');
      }, POLL_MS);
      timer.unref?.();
    } catch (error) {
      log('rpc:', error);
    }
    return cleanup;
  },
};
