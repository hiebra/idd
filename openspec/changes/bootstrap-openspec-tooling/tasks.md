Las secciones 1 a 6 se hicieron con verificación manual en copias desechables del proyecto, antes de decidir que la plantilla tenga suite permanente. Desde la sección 7, la verificación es la suite de aceptación de `acceptance-tests/` (design D9), con el ciclo de `spec-as-source`: rojo → implementar → verde → commit.

## 1. Verificación inicial (rojo)

- [x] 1.1 En un clon limpio de `main`, comprobar que "Clon recién creado" falla hoy: no hay `package.json` ni hook, y `openspec` no está disponible desde el proyecto
- [x] 1.2 Preparar en el scratchpad las condiciones simuladas que necesitan los escenarios: `PATH` sin npm, un `node` falso que informe de la versión 20, un registro de npm inalcanzable (`npm_config_registry`) y un `openspec` global de otra versión

## 2. Dependencias del proyecto (zona de código)

- [x] 2.1 Crear `package.json` con nombre genérico, `"private": true`, `engines.node: ">=22.12"` y `@fission-ai/openspec` fijado exactamente en `1.17.0` en `devDependencies`
- [x] 2.2 Generar `package-lock.json` con `npm install` y crear `.gitignore` con `node_modules/`

## 3. Hook de arranque de sesión (zona de código)

- [x] 3.1 Crear `.claude/hooks/session-start.sh` (ejecutable) que, en este orden: comprueba npm (D7), compara Node con `engines.node` (D6), comprueba el sello de hashes (D4), borra el sello y ejecuta `npm install --no-audit --no-fund` (D3), escribe el sello tras instalar con éxito y ajusta el `PATH` mediante `CLAUDE_ENV_FILE` o avisa de `npx openspec` (D5); siempre termina con código 0 y avisa por stderr con el prefijo `session-start:`
- [x] 3.2 Registrar el hook en `.claude/settings.json` como `SessionStart`, con la ruta `$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh`

## 4. README de la plantilla (zona de código)

- [x] 4.1 Escribir `README.md` con los siete apartados de la primera versión de D8: qué ofrece, requisitos, qué ocurre al abrir sesión, cómo desactivar el hook, instalación manual, cómo se trabaja en la plantilla y aviso a los proyectos derivados

## 5. Verificación manual de los escenarios (verde)

- [x] 5.1 "Clon recién creado": en un clon sin `node_modules`, tras ejecutar el hook, `openspec --version` con el `PATH` de `CLAUDE_ENV_FILE` muestra `1.17.0`
- [x] 5.2 "La máquina tiene otra versión de OpenSpec instalada globalmente": con el `openspec` global simulado, la sesión usa `1.17.0`
- [x] 5.3 "La sesión no permite ajustar el PATH": sin `CLAUDE_ENV_FILE`, el hook avisa y menciona `npx openspec`
- [x] 5.4 "Proyecto derivado con dependencias propias": con una dependencia extra añadida al `package.json` del clon, el hook la instala junto a OpenSpec
- [x] 5.5 "Dependencias al día": una segunda ejecución del hook no lanza `npm install`
- [x] 5.6 "Las dependencias cambiaron desde la última instalación": tras cambiar el `package.json` del clon, el hook reinstala
- [x] 5.7 "Máquina sin npm": con el `PATH` sin npm, el hook avisa, no instala y termina con código 0
- [x] 5.8 "Versión de Node.js inferior a la requerida": con el `node` falso de la versión 20, el aviso indica la versión requerida y la encontrada, no instala y termina con código 0
- [x] 5.9 "Sin acceso al registro de paquetes": con el registro inalcanzable, el hook avisa del fallo, no escribe el sello y termina con código 0
- [x] 5.10 "Reintento tras una instalación fallida": tras 5.9 y con el registro de nuevo accesible, el hook instala las dependencias

## 6. Primer commit de código

- [x] 6.1 Commit de la zona de código (`package.json`, `package-lock.json`, `.gitignore`, `.claude/settings.json`, `.claude/hooks/session-start.sh`, `README.md`) sin ningún archivo de `openspec/`, y push

## 7. Suite de aceptación: puesta en marcha (zona de código)

- [ ] 7.1 Confirmar el stack: `stack: javascript` en `openspec/config.yaml`
- [ ] 7.2 Crear `acceptance-tests/` como proyecto Node independiente: `package.json` con `@cucumber/cucumber`, `glob`, `cheerio` y `gherkin-lint` en `devDependencies` y los scripts `test`, `test:specs` y `lint:specs` de la skill, y su `package-lock.json`
- [ ] 7.3 Copiar tal cual los archivos de referencia de `acceptance-test-authoring` (`extract-gherkin.cjs`, `cucumber.cjs`, `openspec-effective-paths.cjs` y `.gherkin-lintrc`), y comprobar que las rutas resueltas solo apuntan a `.extracted/` y nada de `changes/archive/`
- [ ] 7.4 Comprobar que `npm test` genera siempre el informe HTML en `acceptance-tests/reports/`, y añadir `acceptance-tests/.extracted/` y `acceptance-tests/reports/` al `.gitignore`
- [ ] 7.5 Comprobar que `npm run lint:specs` pasa sobre la spec de `session-bootstrap`
- [ ] 7.6 Crear el soporte de D9 en `acceptance-tests/support/`: World con copias desechables del proyecto, máquinas simuladas (herramientas sin npm, `node` 20 falso, `openspec` global falso, espía de npm, registro inaccesible), `Before`/`After` que crean y borran los temporales, y tiempo máximo por paso ampliado
- [ ] 7.7 Escribir `acceptance-tests/README.md`: cómo ejecutar la suite, dónde queda el informe HTML y cómo se simulan las máquinas
- [ ] 7.8 Ejecutar la suite y comprobar que todos los escenarios de `session-bootstrap` salen con pasos sin definir (rojo)

## 8. Step definitions (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 8.1 "Clon recién creado"
- [ ] 8.2 "La máquina tiene otra versión de OpenSpec instalada globalmente"
- [ ] 8.3 "La sesión no permite ajustar el PATH"
- [ ] 8.4 "Proyecto derivado con dependencias propias"
- [ ] 8.5 "Proyecto con tests de aceptación": con el escenario en rojo, ampliar el hook para instalar `acceptance-tests/` si existe, con su propio sello y siguiendo aunque falle la otra instalación (D3, D4)
- [ ] 8.6 "Dependencias al día"
- [ ] 8.7 "Las dependencias cambiaron desde la última instalación"
- [ ] 8.8 "Las dependencias de los tests de aceptación cambiaron"
- [ ] 8.9 "Máquina sin npm"
- [ ] 8.10 "Versión de Node.js inferior a la requerida"
- [ ] 8.11 "Sin acceso al registro de paquetes"
- [ ] 8.12 "Reintento tras una instalación fallida"

## 9. ADR y README (zona de código)

- [ ] 9.1 Crear `adr/0001-session-bootstrap-hook.md` (título, Status, Date y secciones Context, Decision y Consequences) con la decisión del manifiesto `adr.md`
- [ ] 9.2 Actualizar `README.md` según D8: suite de aceptación, cómo ejecutarla, instalación manual también en `acceptance-tests/`, qué heredan los proyectos derivados; quitar el apartado de changes efímeros

## 10. Cierre

- [ ] 10.1 Ejecutar la suite completa: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado
- [ ] 10.2 Commit y push de la zona de código pendiente, sin archivos de `openspec/`
- [ ] 10.3 Archivar el change con `openspec archive bootstrap-openspec-tooling` en un commit propio, sin archivos de la zona de código, y push
