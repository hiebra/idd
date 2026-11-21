Verificación de `spec-as-source` sin suite permanente: cada escenario de `specs/session-bootstrap/spec.md` se comprueba a mano en un clon desechable fuera del árbol de trabajo (por ejemplo, en el scratchpad de la sesión), ejecutando el hook como lo haría Claude Code (`CLAUDE_PROJECT_DIR` y `CLAUDE_ENV_FILE` apuntando al clon y a un archivo temporal). Ningún script ni artefacto de verificación se añade al repositorio.

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

- [x] 4.1 Escribir `README.md` con los siete apartados de D8: qué ofrece, requisitos, qué ocurre al abrir sesión, cómo desactivar el hook, instalación manual, cómo se trabaja en la plantilla y aviso a los proyectos derivados

## 5. Verificación de los escenarios (verde)

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

## 6. Cierre

- [x] 6.1 Commit de la zona de código (`package.json`, `package-lock.json`, `.gitignore`, `.claude/settings.json`, `.claude/hooks/session-start.sh`, `README.md`) sin ningún archivo de `openspec/`, y push
- [ ] 6.2 Borrar `openspec/changes/bootstrap-openspec-tooling/` en un commit propio, sin archivos de la zona de código, y push; el change queda solo en el historial de git
