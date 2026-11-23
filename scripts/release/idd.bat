@echo off
rem Instalador global de idd para Windows (windows-global-install; design D6
rem de windows-global-distro, ADR-0024). build.mjs escribe dentro su version y
rem la URL de su zip. Solo usa cmd, curl.exe y tar.exe: ni git ni Node.
rem
rem 1. Calcula <data> (XDG_DATA_HOME o LOCALAPPDATA) y <config>
rem    (XDG_CONFIG_HOME o USERPROFILE\.config), como OpenSpec y OpenCode.
rem 2. Lee la version instalada en <data>\idd\version; si es la suya, termina.
rem 3. Descarga el zip en un directorio temporal y saca de el la lista de lo
rem    que instala (installed.txt) y las piezas del SKILL.md.
rem 4. Borra lo que lista <data>\idd\installed.txt, la instalacion anterior, y
rem    solo eso: no toca otras skills ni otros plugins de <config>\opencode.
rem 5. Descomprime lo nuevo en su sitio y escribe el SKILL.md de
rem    openspec-git-discipline con la ruta absoluta de su script, y el comando
rem    /toggle-wiki de OpenCode con la del nucleo del arranque.
rem 6. Escribe installed.txt y, al final, version. Si algo falla antes, la
rem    version guardada no cambia y la siguiente ejecucion lo vuelve a intentar.
rem
rem No valida el schema con openspec schema validate: sale de una release que
rem ya ha pasado la suite. Las rutas van siempre entre comillas, y no se activa
rem la expansion retardada, para que valgan con espacios y con "!".

setlocal EnableExtensions DisableDelayedExpansion

set "IDD_VERSION=@IDD_VERSION@"
set "IDD_URL=@IDD_URL@"

rem Los textos que escribe (la ruta del SKILL.md) van en UTF-8
for /f "tokens=2 delims=:." %%C in ('chcp') do set "IDD_CODEPAGE=%%C"
chcp 65001 >nul

if defined XDG_DATA_HOME (set "IDD_DATA=%XDG_DATA_HOME%") else (set "IDD_DATA=%LOCALAPPDATA%")
if defined XDG_CONFIG_HOME (set "IDD_CONFIG=%XDG_CONFIG_HOME%") else (set "IDD_CONFIG=%USERPROFILE%\.config")
set "IDD_HOME=%IDD_DATA%\idd"

set "IDD_INSTALLED="
if exist "%IDD_HOME%\version" set /p IDD_INSTALLED=<"%IDD_HOME%\version"
if "%IDD_INSTALLED%"=="%IDD_VERSION%" (
  echo idd %IDD_VERSION% ya esta instalada en "%IDD_DATA%" y "%IDD_CONFIG%".
  goto :done
)

if defined IDD_INSTALLED (echo Actualizando idd %IDD_INSTALLED% a %IDD_VERSION%...) else (echo Instalando idd %IDD_VERSION%...)

set "IDD_TMP=%TEMP%\idd-%IDD_VERSION%-%RANDOM%%RANDOM%"
mkdir "%IDD_TMP%\x" || goto :fail
curl.exe -fsSL --retry 2 -o "%IDD_TMP%\idd.zip" "%IDD_URL%" || goto :fail
tar.exe -xf "%IDD_TMP%\idd.zip" -C "%IDD_TMP%\x" installed.txt pieces || goto :fail
if not exist "%IDD_TMP%\x\installed.txt" goto :fail

rem 4. La instalacion anterior, solo lo que ella instalo
if exist "%IDD_HOME%\installed.txt" (
  for /f "usebackq delims=" %%P in ("%IDD_HOME%\installed.txt") do call :remove "%%P"
)
rem Y lo que la nueva va a ocupar, por si quedo a medias
for /f "usebackq delims=" %%P in ("%IDD_TMP%\x\installed.txt") do call :remove "%%P"

rem 5. Lo nuevo, en su sitio
if not exist "%IDD_DATA%" mkdir "%IDD_DATA%" || goto :fail
if not exist "%IDD_CONFIG%" mkdir "%IDD_CONFIG%" || goto :fail
tar.exe -xf "%IDD_TMP%\idd.zip" -C "%IDD_DATA%" --strip-components=1 data || goto :fail
tar.exe -xf "%IDD_TMP%\idd.zip" -C "%IDD_CONFIG%" --strip-components=1 config || goto :fail

set "IDD_SKILL=%IDD_CONFIG%\opencode\skills\openspec-git-discipline"
set "IDD_PIECES=%IDD_TMP%\x\pieces\openspec-git-discipline"
if not exist "%IDD_SKILL%\scripts\branch-change.mjs" goto :fail
type "%IDD_PIECES%\SKILL.head.md" > "%IDD_SKILL%\SKILL.md" || goto :fail
rem La ruta va por una variable de for, que se expande despues de analizar la linea
for %%S in ("%IDD_SKILL%\scripts\branch-change.mjs") do (echo El script es: `%%~S`) >> "%IDD_SKILL%\SKILL.md"
type "%IDD_PIECES%\SKILL.tail.md" >> "%IDD_SKILL%\SKILL.md" || goto :fail

set "IDD_COMMANDS=%IDD_CONFIG%\opencode\commands"
set "IDD_PIECES=%IDD_TMP%\x\pieces\toggle-wiki"
set "IDD_CORE=%IDD_CONFIG%\opencode\plugins\session-bootstrap\session-bootstrap.mjs"
if not exist "%IDD_CORE%" goto :fail
if not exist "%IDD_COMMANDS%" mkdir "%IDD_COMMANDS%" || goto :fail
type "%IDD_PIECES%\toggle-wiki.head.md" > "%IDD_COMMANDS%\toggle-wiki.md" || goto :fail
for %%S in ("%IDD_CORE%") do (echo El script es: `%%~S`) >> "%IDD_COMMANDS%\toggle-wiki.md"
type "%IDD_PIECES%\toggle-wiki.tail.md" >> "%IDD_COMMANDS%\toggle-wiki.md" || goto :fail

rem 6. El manifiesto y, al final, la version
if not exist "%IDD_HOME%" mkdir "%IDD_HOME%" || goto :fail
copy /y "%IDD_TMP%\x\installed.txt" "%IDD_HOME%\installed.txt" >nul || goto :fail
(echo %IDD_VERSION%) > "%IDD_HOME%\version" || goto :fail

rmdir /s /q "%IDD_TMP%" 2>nul
echo idd %IDD_VERSION% instalada en "%IDD_DATA%" y "%IDD_CONFIG%".
goto :done

:fail
if defined IDD_TMP rmdir /s /q "%IDD_TMP%" 2>nul
echo La instalacion de idd %IDD_VERSION% ha fallado; la version guardada no ha cambiado. Vuelve a ejecutar este instalador. 1>&2
if defined IDD_CODEPAGE chcp %IDD_CODEPAGE% >nul
exit /b 1

:done
if defined IDD_CODEPAGE chcp %IDD_CODEPAGE% >nul
exit /b 0

rem :remove ENTRADA: borra una entrada del manifiesto, que es relativa a
rem <data> (data\...) o a <config> (config\...); cualquier otra se ignora
:remove
set "IDD_TARGET="
set "IDD_ENTRY=%~1"
if "%IDD_ENTRY%"=="" exit /b 0
echo(%IDD_ENTRY%| findstr /c:".." >nul && exit /b 0
for /f "tokens=1* delims=\" %%A in ("%IDD_ENTRY%") do (
  if /i "%%A"=="data" if not "%%B"=="" set "IDD_TARGET=%IDD_DATA%\%%B"
  if /i "%%A"=="config" if not "%%B"=="" set "IDD_TARGET=%IDD_CONFIG%\%%B"
)
if not defined IDD_TARGET exit /b 0
if exist "%IDD_TARGET%\" (
  rmdir /s /q "%IDD_TARGET%"
) else if exist "%IDD_TARGET%" (
  del /f /q "%IDD_TARGET%"
)
exit /b 0
