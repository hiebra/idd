# Guía de la task 7.4: verificar en Windows 11 real

Anota el resultado de cada punto (OK, o qué ha fallado y el texto del error) en la task 7.4 de `tasks.md`. Hace falta una máquina Windows 11 con Node.js 22.12 o superior, git y OpenCode 2, y una copia del repositorio en la rama `claude/friendly-shannon-kg3rbc`.

## 1. El diagnóstico, con PowerShell 5.1 y con 7

En la raíz del repositorio, en una consola de cada versión:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\Test-OfflineInstall.ps1
```

```powershell
pwsh -NoProfile -File scripts\windows\Test-OfflineInstall.ps1
```

Comprueba que sale el informe con las tildes bien escritas, y que en este repositorio (plantilla completa) la «Instalación global» sale `OK` con el texto «no necesita la instalación global». Prueba también con `-Json`.

## 2. El `.bat`, en instalación nueva y en actualización

No hay ninguna release publicada, y el `.bat` descarga su zip de la URL de la release. Para probarlo sin publicar, móntalo con una URL local (`curl.exe` entiende `file:///`):

```powershell
git tag v0.1.0-prueba
node scripts\release\build.mjs --repo . --tag v0.1.0-prueba --out "$env:TEMP\idd-dist" --base-url "file:///$($env:TEMP -replace '\\','/')/idd-dist"
```

1. **Instalación nueva.** Mueve antes tu `%LOCALAPPDATA%\idd` si existe, o prueba con `XDG_DATA_HOME` y `XDG_CONFIG_HOME` apuntando a carpetas vacías. Ejecuta `idd-0.1.0-prueba.bat` desde `cmd`. Debe terminar con «idd 0.1.0-prueba instalada» y dejar `<data>\idd\version`, `<data>\openspec\schemas\intent-driven` y, en `<config>\opencode`, las skills y los tres plugins.
2. **Mismo `.bat` otra vez.** Debe decir que ya está instalada y no cambiar nada.
3. **Actualización.** Crea otro tag (`v0.1.1-prueba`), vuelve a montar y ejecuta su `.bat`. Debe quedar la versión nueva, sin restos de la anterior, y tus otras skills de `<config>\opencode\skills` intactas.
4. **Con espacios.** Repite el punto 1 con un perfil o una carpeta con espacios en la ruta.
5. **Si falla.** Apaga la red a medias o borra el zip antes de ejecutarlo: debe avisar de que ha fallado y no cambiar la versión guardada.

Después de instalar, vuelve a pasar el diagnóstico en el proyecto del punto 3: con una instalación completa debe salir `OK`.

## 3. Una sesión real de OpenCode 2 en un proyecto adelgazado

1. Descomprime `idd-slim-0.1.0-prueba.zip` en una carpeta nueva y haz `git init` y un commit.
2. Abre OpenCode 2 en esa carpeta.
3. Comprueba:
   - Aparece sin errores el aviso de que instala dependencias, y termina.
   - `openspec --version` en un comando de la sesión da la versión fijada en `package.json`.
   - La skill `openspec-git-discipline` se carga, y su `SKILL.md` da una ruta absoluta de `branch-change.mjs`.
   - El agente conoce el wiki (guía del wiki) y la regla de comentarios: escribe `''algo'' de prueba` y debe contestar solo con la frase fija.
   - El autopilot actúa: en una rama temporal con un change, la sesión operativa arranca.
   - En un proyecto que no es intent-driven (cambia `schema:` en `openspec/config.yaml`), nada de lo anterior actúa.
4. Cierra con el diagnóstico en esa carpeta: todo `OK`.

Al terminar, borra los tags locales de prueba (`git tag -d v0.1.0-prueba v0.1.1-prueba`).
