---
title: "El puente del autopilot sigue teniendo como destino una TUI cerrada"
kind: task
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Abrir un change de OpenSpec para que el puente del autopilot deje de tener destino al primer vencimiento de una petición a la TUI, hasta el siguiente hello."
sources: []
tags: [opencode, openspec-autopilot, task, tui]
confidence: high
summary: "Tras cerrarse la TUI, el servidor del autopilot la sigue teniendo como destino y espera a que venzan notice, navigate y archive (unos 5 s cada uno) antes de degradarse. Ya pasaba antes de autopilot-plan-explore con navigate y archive."
---

# El puente del autopilot sigue teniendo como destino una TUI cerrada

## Why Track This

Se vio en el punto 8 de la task 7.2 de `autopilot-plan-explore`, con OpenCode 2.3.2 real (`idd@48ca630:openspec/changes/autopilot-plan-explore/tasks.md`). Con la TUI cerrada y un mensaje desde `opencode run`, un cliente sin TUI, el aviso de lo modificado con el agente plan acabó en el mensaje de arranque de la sesión siguiente, como debe. Pero el turno tardó 19 s: el puente del servidor con la TUI (`clientBridge` en `.opencode/plugins/openspec-autopilot/server.js`) seguía teniendo como destino la TUI cerrada, y esperó a que vencieran las peticiones `notice`, `navigate` y `archive`, de unos 5 s cada una, antes de degradarse.

No lo introduce `autopilot-plan-explore`: el puente ya esperaba así con `navigate` y `archive` desde `autopilot-sesion-operativa`. El change solo añade la espera de `notice`. El usuario decidió el 2026-11-22 dejarlo para un change aparte.

## Current State

Abierto. Posible arreglo: al primer vencimiento de una petición a la TUI, el servidor deja de tener destino (`ready()` a falso) hasta el siguiente `hello`, así que solo se espera una vez. Hay que comprobarlo en el simulador (una TUI que deja de responder) y, al cerrar, con OpenCode real.

## Next Action

Abrir un change de OpenSpec para que el puente deje de tener destino al primer vencimiento, con su escenario o core test.
