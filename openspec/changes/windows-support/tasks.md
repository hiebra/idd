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
- [ ] 2.2 Revertir lo que la primera versión de este change hacía en el núcleo del arranque, que resuelve `windows-global-distro` (design D1): `MSYS=winsymlinks:nativestrict` en el núcleo, las rutas relativas de `bin=` y `wiki-engine=` en el núcleo y sus dos adaptadores, la búsqueda de Git Bash en el plugin `session-bootstrap`, `core-tests/opencode-git-bash.test.js`, y los pasos y las simulaciones de sus escenarios (el `ln` de Git Bash, Git for Windows y el bash de WSL simulados, y `win32` y la ruta del proyecto en el host de OpenCode). Comprobar que `git diff` respecto al commit anterior a la primera versión (`ec60c4d`) solo deja en esos archivos lo que pide la 2.1. `test:core` pasa.

Las tasks 2.2 a 2.7 de la primera versión (symlinks nativos, rutas en el formato del agente y Git Bash en OpenCode) se hicieron, con sus escenarios en rojo y luego en verde, y se revierten en la 2.2, por la decisión del usuario de portar el núcleo a Node en `windows-global-distro`. Su historia queda en los commits `052e567` a `9e5b7b8`.

## 3. Autopilot (zona de código)

- [x] 3.1 "El enlace de binarios del CLI no es ejecutable": en la copia, sustituir `node_modules/.bin/openspec` por un archivo no ejecutable. Ver el rojo y hacer que el plugin ejecute con `node` el `bin.openspec` de `node_modules/@fission-ai/openspec/package.json`, y que use el `openspec` del `PATH` si no está (D3).
  - Resultado: con `node_modules/.bin/openspec` no ejecutable, el plugin no podía ejecutar `openspec status` y no se creaba ninguna sesión operativa. Con `openspecCommand()`, que ejecuta con `node` el `bin.openspec` del paquete, la sesión arranca con el paso de `openspec status`. No se usa `process.execPath`, como decía la primera versión del design: en OpenCode es el binario de OpenCode (compilado con Bun), no Node. Corregido en el design. Los escenarios de arranque del autopilot siguen pasando.
- [x] 3.2 En `core-tests/`, el caso sin el CLI del proyecto: usa el `openspec` del `PATH`.
  - Resultado: `core-tests/autopilot-openspec-cli.test.js`: sin el paquete, el `openspec` del PATH; con él, su script con `node`, sin `node_modules/.bin/`. `test:core` da 116 de 116.

## 4. Diagnóstico (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 4.1 Reestructurar `scripts/windows/Test-OfflineInstall.ps1` según D4: `Get-ReadinessFacts` (recogida), `Get-ReadinessReport` (evaluación, sin tocar la máquina) y `-FactsFile <json>` para evaluar unos hechos dados. Quitar las comprobaciones que dependían del núcleo bash: Git Bash y sus utilidades, `MSYS`, qué bash va primero en el `PATH`, los symlinks, el Modo de desarrollador y el nombre `python3`. Comprobar a mano con `pwsh` que el script se carga y que, con unos hechos de ejemplo, da un informe.
- [ ] 4.2 Soporte en `acceptance-tests/support/` para «una máquina Windows …»: hechos de una máquina con todo lo necesario, que cada `But` modifica, un proyecto temporal con sus lockfiles, y la ejecución del script con `pwsh -NoProfile -File … -FactsFile …` (y `-Json` cuando el paso lo pide), leyendo el código de salida y el informe. Si no hay `pwsh`, el paso falla con un mensaje que lo dice.
- [ ] 4.3 "Máquina con todo lo necesario", "No falta nada" y "Falta algo".
- [ ] 4.4 "Falta Node.js", "Node.js de una versión inferior a la requerida" y "Lo que está en el vendor del repositorio cuenta como presente".
- [ ] 4.5 "Dependencias instaladas en otro sistema operativo" (con el `acceptance-tests/package-lock.json` del proyecto: `@esbuild/win32-x64` sí, `@esbuild/linux-x64` no).
- [ ] 4.6 "Dependencias solo en la caché global sin modo offline".
- [ ] 4.7 "Motor sin instalar que solo está en GitHub" y "Motor sin instalar con una fuente local" (un bundle real con el tag fijado).
- [ ] 4.8 "Solo el alias de la Microsoft Store".
- [ ] 4.9 "Clon extraído con CRLF antes de fijar los finales de línea" (añade a los hechos los archivos de texto versionados del clon con CRLF).
- [ ] 4.10 "Solo Claude Code" y "OpenCode 1".
- [ ] 4.11 "Informe en JSON".

## 5. Documentación (zona de código)

- [ ] 5.1 `README.md`: una sección «Windows» que dice que solo se soporta OpenCode 2, que el arranque en Windows llega con `windows-global-distro`, cómo ejecutar el diagnóstico y cómo volver a extraer con LF un clon existente (design, Migration Plan).
- [ ] 5.2 `acceptance-tests/README.md`: `pwsh` entre los requisitos, y secciones de los escenarios de `windows-readiness` (D4), del de finales de línea en `session-bootstrap` (D2) y del CLI en `openspec-autopilot` (D3).

## 6. Verificación en Windows 11 real

Trasladada a `windows-global-distro` (design D1), por decisión del usuario: se hace una sola vez, con los dos changes fusionados. Comprende el diagnóstico con Windows PowerShell 5.1 y con PowerShell 7, sin red, y una sesión real de OpenCode 2 en Windows 11.

## 7. Cierre

- [ ] 7.1 Ejecutar la suite completa con el delta del change, `npm run test:core` y `npm run lint:specs`: todo pasa, cero pasos pendientes o sin definir, informe HTML generado. Anotar aquí el resultado.
- [ ] 7.2 `openspec validate windows-support --type change --strict` sin errores.
