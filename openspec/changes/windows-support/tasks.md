# Tasks: windows-support

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Las tasks por escenario siguen el ciclo de siempre: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Preparación

- [x] 1.1 Dejar `pwsh` (PowerShell 7) disponible en la sesión: proponer al usuario añadir su instalación al script de configuración del entorno de la nube (Open Question 1 del design: paquete de Microsoft o tarball de GitHub) y, aprobada, instalarlo en esta sesión. Comprobar `pwsh -v`. Sin `pwsh` no se puede hacer la sección 4.
  - Resultado: entorno personal `idd` (para `hiebra/idd`) con un script de configuración que instala PowerShell 7.4.6 desde el tarball de las releases de GitHub en `/opt/microsoft/powershell/7`, con `pwsh` en `/usr/local/bin`. El script se probó en esta sesión, y `pwsh -v` da 7.4.6.
- [x] 1.2 Ejecutar la suite con el delta del change: los escenarios nuevos de `windows-readiness`, `session-bootstrap` y `openspec-autopilot` salen con pasos sin definir, y el resto pasa. Anotar aquí el resultado.
  - Resultado: 227 escenarios, 203 pasan y 24 sin definir (los nuevos del change); ninguno falla.

## 2. Finales de línea (zona de código)

- [x] 2.1 "Clon con conversión de finales de línea": definir los pasos según D2 (un clon real de la copia con `-c core.autocrlf=true`, sesión de OpenCode). Ver el rojo sin `.gitattributes`. Añadir `.gitattributes` con `* text=auto eol=lf` (D2) y comprobar con `git ls-files --eol` que el índice del repositorio ya está en LF.
  - Resultado: sin `.gitattributes`, el clon con `autocrlf` extrae los cuatro scripts del arranque con CRLF y el paso falla. Con `* text=auto eol=lf`, pasa. `git ls-files --eol` da `i/lf` en todos los archivos de texto del índice; `git add --renormalize .` no cambia ninguno.
- [x] 2.2 Revertir lo que la primera versión de este change hacía en el núcleo del arranque, que resuelve `windows-global-distro` (design D1): `MSYS=winsymlinks:nativestrict` en el núcleo, las rutas relativas de `bin=` y `wiki-engine=` en el núcleo y sus dos adaptadores, la búsqueda de Git Bash en el plugin `session-bootstrap`, `core-tests/opencode-git-bash.test.js`, y los pasos y las simulaciones de sus escenarios (el `ln` de Git Bash, Git for Windows y el bash de WSL simulados, y `win32` y la ruta del proyecto en el host de OpenCode). Comprobar que `git diff` respecto al commit anterior a la primera versión (`ec60c4d`) solo deja en esos archivos lo que pide la 2.1. `test:core` pasa.
  - Resultado: `git diff ec60c4d` de `.agents/hooks/`, `.claude/hooks/` y `.opencode/plugins/session-bootstrap/` sale vacío. En la suite quedan los pasos de LF (`step-definitions/line-endings.steps.js`) y vuelven a su estado anterior `support/machine.js` y el adaptador y el host de OpenCode. ADR-0017 se reescribe sin las decisiones sobre el núcleo y pasa a `adr/0017-windows-support-opencode-lf-diagnostic.md`. `test:core` da 111 de 111 (116 menos los 5 de Git Bash). En la primera ejecución falló una prueba que no se repitió en tres más, y no quedó cuál. Los escenarios de LF, del CLI del autopilot y de `PATH` de los dos agentes pasan.

Las tasks 2.2 a 2.7 de la primera versión (symlinks nativos, rutas en el formato del agente y Git Bash en OpenCode) se hicieron, con sus escenarios en rojo y luego en verde, y se revierten en la 2.2, por la decisión del usuario de portar el núcleo a Node en `windows-global-distro`. Su historia queda en los commits `052e567` a `9e5b7b8`.

## 3. Autopilot (zona de código)

- [x] 3.1 "El enlace de binarios del CLI no es ejecutable": en la copia, sustituir `node_modules/.bin/openspec` por un archivo no ejecutable. Ver el rojo y hacer que el plugin ejecute con `node` el `bin.openspec` de `node_modules/@fission-ai/openspec/package.json`, y que use el `openspec` del `PATH` si no está (D3).
  - Resultado: con `node_modules/.bin/openspec` no ejecutable, el plugin no podía ejecutar `openspec status` y no se creaba ninguna sesión operativa. Con `openspecCommand()`, que ejecuta con `node` el `bin.openspec` del paquete, la sesión arranca con el paso de `openspec status`. No se usa `process.execPath`, como decía la primera versión del design: en OpenCode es el binario de OpenCode (compilado con Bun), no Node. Corregido en el design. Los escenarios de arranque del autopilot siguen pasando.
- [x] 3.2 En `core-tests/`, el caso sin el CLI del proyecto: usa el `openspec` del `PATH`.
  - Resultado: `core-tests/autopilot-openspec-cli.test.js`: sin el paquete, el `openspec` del PATH; con él, su script con `node`, sin `node_modules/.bin/`. `test:core` da 116 de 116.

## 4. Diagnóstico (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 4.1 Reestructurar `scripts/windows/Test-OfflineInstall.ps1` según D4: `Get-ReadinessFacts` (recogida), `Get-ReadinessReport` (evaluación, sin tocar la máquina) y `-FactsFile <json>` para evaluar unos hechos dados. Quitar las comprobaciones que dependían del núcleo bash: Git Bash y sus utilidades, `MSYS`, qué bash va primero en el `PATH`, los symlinks, el Modo de desarrollador y el nombre `python3`. Comprobar a mano con `pwsh` que el script se carga y que, con unos hechos de ejemplo, da un informe.
  - Resultado: el script tiene `Get-ReadinessFacts` (recoge, sin decidir), `Get-ReadinessReport` (evalúa: filtros de plataforma, versiones, estados y textos) y `-FactsFile`. Los hechos recogidos pasan por JSON antes de evaluarse, para que la evaluación vea siempre la misma forma que con `-FactsFile`. Cada componente tiene un `Id` estable (`node`, `npm`, `npx`, `git`, `python`, `line-endings`, `wiki-engine`, `npm-root`, `npm-acceptance-tests`, `agent`). El parser de PowerShell no da errores, y recogiendo los hechos de la máquina de la suite (Linux, `pwsh` 7.4.6) da un informe y no cambia el árbol. Lección: al reescribir el archivo se duplicó el BOM UTF-8, y PowerShell dejó de reconocer el bloque de ayuda; hay que escribirlo con un solo BOM.
- [x] 4.2 Soporte en `acceptance-tests/support/` para «una máquina Windows …»: hechos de una máquina con todo lo necesario, que cada `But` modifica, un proyecto temporal con sus lockfiles, y la ejecución del script con `pwsh -NoProfile -File … -FactsFile …` (y `-Json` cuando el paso lo pide), leyendo el código de salida y el informe. Si no hay `pwsh`, el paso falla con un mensaje que lo dice.
  - Resultado: `support/windows-readiness.js` construye los hechos de una máquina con todo lo necesario, con los lockfiles reales del proyecto, y ejecuta el script con `pwsh -NoProfile -NonInteractive -File … -FactsFile …`. Sin `pwsh`, el paso falla diciendo que hace falta. Los pasos están en `step-definitions/windows-readiness.steps.js`. «Se ejecuta el diagnóstico» lo ejecuta dos veces, en texto y en JSON, y comprueba que terminan igual. «El árbol no ha cambiado» lo ejecuta además recogiendo los hechos de la máquina de la suite.
- [x] 4.3 "Máquina con todo lo necesario", "No falta nada" y "Falta algo".
  - Resultado: con el script anterior, que no tiene `-FactsFile`, todos los escenarios de `windows-readiness` fallan en «se ejecuta el diagnóstico» (comprobado con «Falta Node.js»). Por eso el rojo es el mismo para toda la sección, y no uno por escenario. Con el script de 4.1, los tres pasan.
- [x] 4.4 "Falta Node.js", "Node.js de una versión inferior a la requerida" y "Lo que está en el vendor del repositorio cuenta como presente".
  - Resultado: pasan los tres, con el rojo de 4.3.
- [x] 4.5 "Dependencias instaladas en otro sistema operativo" (con el `acceptance-tests/package-lock.json` del proyecto: `@esbuild/win32-x64` sí, `@esbuild/linux-x64` no).
  - Resultado: pasa. Con el `acceptance-tests/package-lock.json` real, faltan los dos paquetes que solo se instalan en `win32-x64`, `@esbuild/win32-x64@0.28.2` y `@typescript/typescript-win32-x64@7.0.2`. `@esbuild/linux-x64` no se nombra, porque no se instala en `win32`.
- [x] 4.6 "Dependencias solo en la caché global sin modo offline".
  - Resultado: pasa (AVISO, y la alternativa global es `npm config set offline true`).
- [x] 4.7 "Motor sin instalar que solo está en GitHub" y "Motor sin instalar con una fuente local" (un bundle real con el tag fijado).
  - Resultado: pasan los dos. La recogida de la fuente local (`git ls-remote` sobre el bundle) no la cubre la suite: se comprueba en Windows real (sección 6, trasladada).
- [x] 4.8 "Solo el alias de la Microsoft Store".
  - Resultado: pasa.
- [x] 4.9 "Clon extraído con CRLF antes de fijar los finales de línea" (añade a los hechos los archivos de texto versionados del clon con CRLF).
  - Resultado: pasa. La recogida usa `git ls-files --eol` y toma las líneas con `w/crlf`.
- [x] 4.10 "Solo Claude Code" y "OpenCode 1".
  - Resultado: pasan los dos.
- [x] 4.11 "Informe en JSON".
  - Resultado: pasa. Suite completa tras la sección 4: 220 escenarios y 1156 pasos, todos pasan.

## 5. Documentación (zona de código)

- [ ] 5.1 `README.md`: una sección «Windows» que dice que solo se soporta OpenCode 2, que el arranque en Windows llega con `windows-global-distro`, cómo ejecutar el diagnóstico y cómo volver a extraer con LF un clon existente (design, Migration Plan).
- [ ] 5.2 `acceptance-tests/README.md`: `pwsh` entre los requisitos, y secciones de los escenarios de `windows-readiness` (D4), del de finales de línea en `session-bootstrap` (D2) y del CLI en `openspec-autopilot` (D3).

## 6. Verificación en Windows 11 real

Trasladada a `windows-global-distro` (design D1), por decisión del usuario: se hace una sola vez, con los dos changes fusionados. Comprende el diagnóstico con Windows PowerShell 5.1 y con PowerShell 7, sin red, y una sesión real de OpenCode 2 en Windows 11.

## 7. Cierre

- [ ] 7.1 Ejecutar la suite completa con el delta del change, `npm run test:core` y `npm run lint:specs`: todo pasa, cero pasos pendientes o sin definir, informe HTML generado. Anotar aquí el resultado.
- [ ] 7.2 `openspec validate windows-support --type change --strict` sin errores.
