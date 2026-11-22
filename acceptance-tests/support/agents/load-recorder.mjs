// Module hooks for the simulated OpenCode (opencode-sim-process.mjs): reports
// every branch-change.mjs that the process imports, so that scenarios can tell
// which copy the plugin uses (design D4 of windows-global-distro). Node runs
// these hooks in a thread of its own; the URLs go back through a port.

let port = null;

export function initialize(data) {
  port = data.port;
}

export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  if (port && /\/branch-change\.mjs(\?|$)/.test(result.url)) port.postMessage(result.url);
  return result;
}
