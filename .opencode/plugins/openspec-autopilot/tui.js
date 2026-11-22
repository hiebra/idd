// Parte de TUI del plugin openspec-autopilot para OpenCode 2 (ADR-0022;
// design D1, D3, D4 y D14 de autopilot-sesion-operativa y D2 a D4 de
// autopilot-rama-por-sesion): solo interfaz. La lógica vive en server.js,
// que la TUI consulta por el RPC del plugin.
//
// - Hay una instancia de la parte de servidor por directorio. Cada llamada
//   lleva la ubicación del momento (context.location, que cambia al saltar a
//   una sesión de otro worktree o repositorio), no la del arranque: sin ella,
//   en la pantalla de inicio no llega a la parte de servidor (rpc.unavailable).
// - Se presenta con hello({ instance, pid }) a la instancia de cada directorio
//   la primera vez que entra en él: el PID dice al servidor si es un arranque
//   (otro proceso) o una recarga en caliente (el mismo). Si esa instancia
//   todavía no ha registrado su RPC, lo reintenta sin escribir nada; el
//   servidor la vuelve a pedir con hello-request, que solo se atiende para
//   los directorios en que ya ha estado la TUI y el de ahora.
// - Cada 300 ms consulta la pantalla (ui.router.current(), que no tiene
//   evento) y, al cambiar o al recuperar el foco del terminal
//   (renderer "focus"), pregunta al servidor qué hacer (screen), con la
//   pantalla anterior.
// - Las directivas: un aviso; volver a la pantalla anterior (cuando no se
//   puede pasar a la rama de una sesión); el modal de `/new`, con «Crear un
//   worktree nuevo» (abre el diálogo de nombre de worktree de OpenCode con su
//   keymap), «Cambiar a la rama de origen» y, al cerrarlo sin elegir, la
//   vuelta a la pantalla anterior; el modal de una discrepancia; y navegar.
//   Ningún modal se repite en bucle: no se abre otro mientras hay uno, ni otra
//   vez en la misma pantalla hasta que cambie la pantalla o vuelva el foco,
//   ni en la pantalla a la que el propio plugin acaba de navegar.
// - Atiende las peticiones del servidor: avisos, navegar y archivar con el
//   cliente de la TUI (el del servidor no archiva).
//
// Al descargarse (antes de cada recarga y al cerrar), la función que devuelve
// setup da de baja los eventos, para el temporizador y los reintentos y deja
// de escuchar el foco (ADR-0011). Sin dependencias y sin lanzar nunca una
// excepción hacia OpenCode.

import { HELLO_RETRY_MS, RPC, rpcUnavailable } from './lib/rpc.mjs';

// Las pausas antes de abrir «Name worktree» tras «Manage workspaces» (design D4)
const NAME_DIALOG_PAUSES_MS = [200, 600];

const log = (...args) => console.error(`[${RPC.id}]`, ...args);
const POLL_MS = 300;

const routeKey = (route, dir) => (route?.type === 'session' ? `session:${route.sessionID}` : `${route?.type ?? 'home'}:${dir ?? ''}`);

export default {
  id: RPC.id,
  async setup(context) {
    const instance = `tui-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const subscriptions = new AbortController();
    const { signal } = subscriptions;
    let timer = null;
    const retries = new Set();
    const renderer = context.renderer;
    let onFocus = null;
    const cleanup = () => {
      subscriptions.abort();
      if (timer) clearInterval(timer);
      for (const retry of retries) clearTimeout(retry);
      retries.clear();
      try {
        if (onFocus) renderer?.off?.('focus', onFocus);
      } catch (error) {
        log('focus:', error);
      }
    };

    try {
      const client = context.client.rpc(RPC);
      // La ubicación de cada llamada, la del momento (D2 de autopilot-rama-por-sesion)
      const here = () => {
        try {
          return context.location?.directory ?? null;
        } catch {
          return null;
        }
      };
      const at = (dir = here()) => (dir ? { location: { directory: dir } } : undefined);
      const presented = new Set(); // directorios a cuya instancia se ha presentado
      const presenting = new Map(); // directorio -> promesa del hello en curso
      let lastKey = null;
      let previous = null; // la última pantalla de la que se informó, con su directorio
      let modalOpen = false;
      let shownKey = null;
      let expected = null; // la pantalla a la que el plugin acaba de navegar

      const current = () => {
        try {
          return context.ui.router.current() ?? { type: 'home' };
        } catch {
          return { type: 'home' };
        }
      };

      const navigateTo = (route) => {
        if (route?.type === 'session' && route.sessionID) {
          expected = `session:${route.sessionID}`;
          context.ui.router.navigate({ type: 'session', sessionID: route.sessionID });
          return;
        }
        const dir = route?.directory ?? route?.location?.directory ?? here();
        expected = routeKey({ type: 'home' }, dir);
        context.ui.router.navigate({ type: 'home', ...(dir ? { location: { directory: dir } } : {}) });
      };

      const go = (sessionID) => navigateTo({ type: 'session', sessionID });

      const toast = (message, variant = 'info') => {
        try {
          context.ui.toast.show({ message: String(message ?? ''), variant });
        } catch (error) {
          log('toast:', error);
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

      // El modal de `/new` (D4 de autopilot-rama-por-sesion)
      const showModal = async (d, key, from, dir) => {
        modalOpen = true;
        shownKey = key;
        let choice;
        try {
          choice = await context.ui.dialog.select({ title: d.message, options: d.options ?? [] });
        } catch (error) {
          log('modal:', error);
        }
        modalOpen = false;
        if (signal.aborted) return;
        try {
          if (choice === 'worktree') {
            const keymap = context.keymap;
            if (typeof keymap?.dispatch !== 'function') {
              toast('openspec-autopilot: esta TUI no deja abrir el diálogo de worktrees; ábrelo con «Manage workspaces».', 'warning');
              return;
            }
            // «Manage workspaces» tarda en montarse: un dispatch seguido no abre
            // «Name worktree» (comprobado con OpenCode 2.3.2; design D4)
            await keymap.dispatch('session.move');
            let opened = false;
            for (const pause of NAME_DIALOG_PAUSES_MS) {
              await new Promise((resolve) => setTimeout(resolve, pause));
              if (signal.aborted) return;
              opened = (await keymap.dispatch('dialog.move_session.new')) !== false;
              if (opened) break;
            }
            if (!opened) toast('openspec-autopilot: no se ha podido abrir el diálogo de nombre; pulsa ctrl+a en «Manage workspaces».', 'warning');
          } else if (choice === 'origin') {
            const result = await client.origin({ instance }, at(dir));
            toast(result?.message ?? '', result?.ok ? 'info' : 'warning');
          } else if (from) {
            // Cerrado sin elegir: a la pantalla de la que se venía
            navigateTo(from);
          }
        } catch (error) {
          log('modal:', error);
          toast(`openspec-autopilot: no se ha podido seguir (${error?.message ?? error}).`, 'warning');
        }
      };

      const hello = (dir, attempt = 0) => {
        if (signal.aborted || !dir) return Promise.resolve();
        if (presenting.has(dir) && attempt === 0) return presenting.get(dir);
        const p = (async () => {
          try {
            // Con la ruta: la sesión con que OpenCode crea un worktree desde la
            // pantalla de inicio da la descripción del change (design D10)
            const route = current();
            const at_ = route?.type === 'session' && route.sessionID ? { type: 'session', sessionID: route.sessionID } : { type: route?.type ?? 'home' };
            await client.hello({ instance, pid: process.pid, client: 'tui', route: at_ }, at(dir));
            presented.add(dir);
          } catch (error) {
            if (rpcUnavailable(error) && attempt < HELLO_RETRY_MS.length) {
              // El servidor todavía no ha registrado su RPC: hello-request llegará igual
              const retry = setTimeout(() => {
                retries.delete(retry);
                hello(dir, attempt + 1);
              }, HELLO_RETRY_MS[attempt]);
              retry.unref?.();
              retries.add(retry);
              return;
            }
            log('hello:', error);
          } finally {
            presenting.delete(dir);
          }
        })();
        presenting.set(dir, p);
        return p;
      };

      const report = async (reason) => {
        if (modalOpen || signal.aborted) return;
        let dir = here();
        // La primera vez en un directorio, la TUI se presenta a su instancia
        if (dir && !presented.has(dir)) {
          await hello(dir);
          if (!presented.has(dir)) return;
          dir = here();
        }
        const route = current();
        const key = routeKey(route, dir);
        if (key === expected) {
          expected = null;
          previous = { ...route, directory: dir };
          return;
        }
        if (reason === 'focus') shownKey = null;
        const from = previous;
        const shown = { ...route, directory: dir };
        if (reason === 'route') previous = shown;
        let d;
        try {
          d = await client.screen({ instance, route: shown, previous: from, reason }, at(dir));
        } catch (error) {
          if (!rpcUnavailable(error)) log('screen:', error);
          return;
        }
        if (signal.aborted || routeKey(current(), here()) !== key) return;
        if (d?.toast?.message) toast(d.toast.message, d.toast.variant ?? 'info');
        if (d?.action === 'toast') toast(d.message, d.variant ?? 'info');
        else if (d?.action === 'back') {
          toast(d.message, 'warning');
          previous = from;
          navigateTo(from ?? { type: 'home', directory: dir });
        } else if (d?.action === 'modal' && shownKey !== key) await showModal(d, key, from, dir);
        else if (d?.action === 'notice' && shownKey !== key) {
          shownKey = key;
          await showNotice(d);
        } else if (d?.action === 'navigate' && d.sessionID) go(d.sessionID);
      };

      const perform = async (op, args) => {
        switch (op) {
          case 'toast':
            toast(args?.message, args?.variant === 'info' ? 'info' : 'warning');
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

      client.events.on('hello-request', (event) => {
        // Solo los directorios en que ya ha estado la TUI y el de ahora
        const dir = event?.data?.directory ?? here();
        if (presented.has(dir) || dir === here()) {
          presented.delete(dir);
          hello(dir);
        }
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
          await client.reply({ id: request.id, instance, value, error }, at(request.directory ?? here()));
        } catch (e) {
          log('reply:', e);
        }
      }, { signal });

      onFocus = () => {
        report('focus');
      };
      renderer?.on?.('focus', onFocus);

      await hello(here());
      timer = setInterval(() => {
        const key = routeKey(current(), here());
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
