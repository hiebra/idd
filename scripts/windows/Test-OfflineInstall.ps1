<#
.SYNOPSIS
  Diagnostica qué le falta a esta máquina Windows 11 para una instalación
  completa del proyecto sin acceso a internet.

.DESCRIPTION
  Comprueba cada binario y cada dato que el proyecto necesita (el arranque de
  sesión, el motor del wiki, las dependencias npm de la raíz y de
  acceptance-tests/ y el agente) y, para lo que no está, dice:

    - Repo:   qué habría que incorporar al repositorio (bajo vendor\windows\,
              por defecto) para que funcione sin internet.
    - Global: la alternativa de instalarlo globalmente en la máquina, si existe.
    - Obtener: cómo conseguirlo en una máquina CON internet.

  No instala ni cambia nada, y no usa la red.

  Lo que ya esté en el directorio de vendor cuenta como presente ("OK (vendor)"),
  así que el script sirve también para comprobar un vendor ya montado.

.PARAMETER ProjectDir
  Raíz del proyecto. Por defecto, dos niveles por encima de este script.

.PARAMETER VendorDir
  Directorio del repositorio donde se incorporarían los binarios y datos.
  Por defecto, <ProjectDir>\vendor\windows.

.PARAMETER Json
  Devuelve el resultado como JSON en vez de como informe de texto.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\Test-OfflineInstall.ps1

.EXAMPLE
  pwsh -File scripts\windows\Test-OfflineInstall.ps1 -Json > informe.json

.NOTES
  Código de salida: 0 si no falta nada, 1 si falta algo (estado FALTA).
  Compatible con Windows PowerShell 5.1 y PowerShell 7+.
#>
[CmdletBinding()]
param(
  [string]$ProjectDir,
  [string]$VendorDir,
  [switch]$Json
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

# --- Parámetros por defecto -------------------------------------------------

if (-not $ProjectDir) { $ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$ProjectDir = (Resolve-Path $ProjectDir).Path
if (-not $VendorDir) { $VendorDir = Join-Path $ProjectDir 'vendor\windows' }
$VendorRel = $VendorDir
if ($VendorDir.StartsWith($ProjectDir, [StringComparison]::OrdinalIgnoreCase)) {
  $VendorRel = $VendorDir.Substring($ProjectDir.Length).TrimStart('\', '/')
}

# Arquitectura con los nombres de Node (os/cpu de package-lock.json)
$NodeOs = 'win32'
switch ($env:PROCESSOR_ARCHITECTURE) {
  'ARM64' { $NodeCpu = 'arm64' }
  'x86'   { $NodeCpu = 'ia32' }
  default { $NodeCpu = 'x64' }
}

$Results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Componente,
    [ValidateSet('binario', 'datos', 'configuración')][string]$Tipo,
    [ValidateSet('OK', 'OK (vendor)', 'AVISO', 'FALTA')][string]$Estado,
    [string]$Detalle,
    [string]$Repo = '',
    [string]$Global = '',
    [string]$Obtener = ''
  )
  $Results.Add([pscustomobject][ordered]@{
      Componente = $Componente
      Tipo       = $Tipo
      Estado     = $Estado
      Detalle    = $Detalle
      Repo       = $Repo
      Global     = $Global
      Obtener    = $Obtener
    })
}

# --- Utilidades -------------------------------------------------------------

# Ejecuta un programa y devuelve su salida (stdout+stderr) recortada, o $null si falla
function Invoke-Quiet {
  param([string]$Exe, [string[]]$Arguments)
  # En Windows PowerShell 5.1, con Stop, cualquier línea en stderr sería un error
  $ErrorActionPreference = 'Continue'
  try {
    $out = & $Exe @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { return $null }
    return $out.Trim()
  } catch { return $null }
}

# Todas las rutas del PATH para un nombre, sin los alias de la Microsoft Store
function Find-Exe {
  param([string[]]$Names)
  $found = @()
  foreach ($n in $Names) {
    foreach ($c in @(Get-Command $n -CommandType Application -All -ErrorAction SilentlyContinue)) {
      $found += $c.Source
    }
  }
  return @($found | Select-Object -Unique)
}

function Test-StoreStub {
  param([string]$Path)
  if ($Path -notmatch '\\WindowsApps\\') { return $false }
  try { return ((Get-Item $Path -Force).Length -eq 0) } catch { return $true }
}

function Get-Version {
  param([string]$Text)
  if ($Text -match '(\d+)\.(\d+)(?:\.(\d+))?') {
    $patch = 0; if ($Matches[3]) { $patch = [int]$Matches[3] }
    return New-Object Version -ArgumentList @([int]$Matches[1], [int]$Matches[2], $patch)
  }
  return $null
}

# Lee un JSON; Windows PowerShell 5.1 no admite claves vacías (la "" de package-lock.json)
function Read-Json {
  param([string]$Path)
  $raw = [IO.File]::ReadAllText($Path)
  $raw = $raw -replace '"":', '"__root__":'
  return $raw | ConvertFrom-Json
}

function Get-Prop {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return $null }
  $p = $Object.PSObject.Properties[$Name]
  if ($p) { return $p.Value }
  return $null
}

# integrity de npm (sha512-<base64>) -> ruta en content-v2 de un cacache
function Get-CacachePath {
  param([string]$CacheRoot, [string]$Integrity)
  if ($Integrity -notmatch '^(sha\d+)-(.+)$') { return $null }
  $algo = $Matches[1]
  try { $bytes = [Convert]::FromBase64String(($Matches[2] -split '\s')[0]) } catch { return $null }
  $hex = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  return Join-Path $CacheRoot ("_cacache\content-v2\{0}\{1}\{2}\{3}" -f $algo, $hex.Substring(0, 2), $hex.Substring(2, 2), $hex.Substring(4))
}

# El paquete del lockfile se instala en esta plataforma (campos os/cpu)
function Test-Platform {
  param($Values, [string]$Current)
  if ($null -eq $Values) { return $true }
  $list = @($Values)
  $neg = @($list | Where-Object { $_ -like '!*' })
  $pos = @($list | Where-Object { $_ -notlike '!*' })
  if ($neg -contains "!$Current") { return $false }
  if ($pos.Count -gt 0 -and -not ($pos -contains $Current)) { return $false }
  return $true
}

$VendorNode   = Join-Path $VendorDir 'node'
$VendorGit    = Join-Path $VendorDir 'git'
$VendorPython = Join-Path $VendorDir 'python'
$VendorCache  = Join-Path $VendorDir 'npm-cache'

# --- 1. Node.js y npm ---------------------------------------------------------

$NodeExe = $null; $NpmCmd = $null; $NodeSource = $null
$pkg = Read-Json (Join-Path $ProjectDir 'package.json')
$engines = Get-Prop $pkg 'engines'
$nodeRange = Get-Prop $engines 'node'
$nodeMin = $null
if ($nodeRange -match '>=\s*v?(\d+(?:\.\d+){0,2})') { $nodeMin = Get-Version $Matches[1] }
if (-not $nodeMin) { $nodeMin = New-Object Version 22, 12, 0 }

$candidates = @()
if (Test-Path (Join-Path $VendorNode 'node.exe')) { $candidates += , @((Join-Path $VendorNode 'node.exe'), 'vendor') }
foreach ($p in Find-Exe 'node') { $candidates += , @($p, 'PATH') }
$nodeIssues = @()
foreach ($c in $candidates) {
  $v = Get-Version (Invoke-Quiet $c[0] @('--version'))
  if ($v -and $v -ge $nodeMin) { $NodeExe = $c[0]; $NodeSource = $c[1]; $NodeVersion = $v; break }
  if ($v) { $nodeIssues += "$($c[0]) es $v" }
}
$nodeRepo = "Node.js portable (zip) descomprimido en $VendorRel\node\ (node.exe, npm.cmd, npx.cmd, node_modules\npm). El arranque y los hooks deben poner ese directorio por delante en el PATH."
$nodeGlobal = "Instalador MSI de Node.js $nodeMin o superior (LTS 22.x o 24.x) para $NodeCpu, que añade node y npm al PATH del sistema. Sin internet: copia el .msi y ejecuta 'msiexec /i node-v22.x.y-$NodeCpu.msi'."
$nodeGet = "https://nodejs.org/dist/latest-v22.x/ -> node-v22.x.y-win-$NodeCpu.zip (repo) o node-v22.x.y-$NodeCpu.msi (global). Con winget: 'winget download OpenJS.NodeJS.LTS'."
if ($NodeExe) {
  $estado = 'OK'; if ($NodeSource -eq 'vendor') { $estado = 'OK (vendor)' }
  Add-Result 'Node.js' 'binario' $estado "node $NodeVersion en $NodeExe (requiere $nodeRange)"
  $nodeDir = Split-Path $NodeExe
  foreach ($n in @('npm.cmd', 'npx.cmd')) {
    $c = Join-Path $nodeDir $n
    if (-not (Test-Path $c)) { $f = @(Find-Exe $n.Replace('.cmd', '')); if ($f.Count -gt 0) { $c = $f[0] } else { $c = $null } }
    if ($n -eq 'npm.cmd') { $NpmCmd = $c }
    if ($c) { Add-Result $n.Replace('.cmd', '') 'binario' $estado "$c" }
    else { Add-Result $n.Replace('.cmd', '') 'binario' 'FALTA' "No se encuentra $n junto a node.exe ni en el PATH" $nodeRepo $nodeGlobal $nodeGet }
  }
} else {
  $det = "No hay Node.js $nodeRange (requisito de package.json)"
  if ($nodeIssues) { $det += ". Encontrado: " + ($nodeIssues -join '; ') }
  Add-Result 'Node.js + npm' 'binario' 'FALTA' $det $nodeRepo $nodeGlobal $nodeGet
}

# --- 2. Git, bash y las utilidades de coreutils ------------------------------

$GitExe = $null; $GitRoot = $null; $GitSource = $null
$gitCandidates = @()
foreach ($rel in @('cmd\git.exe', 'bin\git.exe', 'mingw64\bin\git.exe')) {
  $p = Join-Path $VendorGit $rel
  if (Test-Path $p) { $gitCandidates += , @($p, 'vendor'); break }
}
foreach ($p in Find-Exe 'git') { $gitCandidates += , @($p, 'PATH') }
foreach ($c in $gitCandidates) {
  $out = Invoke-Quiet $c[0] @('--version')
  if ($out -match 'git version') { $GitExe = $c[0]; $GitSource = $c[1]; $GitVersion = $out; break }
}
if ($GitExe) {
  $d = Split-Path $GitExe
  if ((Split-Path $d -Leaf) -eq 'bin' -and (Split-Path (Split-Path $d) -Leaf) -eq 'mingw64') { $GitRoot = Split-Path (Split-Path $d) }
  else { $GitRoot = Split-Path $d }
}
$gitRepo = "PortableGit (Git for Windows portable) descomprimido en $VendorRel\git\: aporta git.exe (cmd\), bash.exe (bin\) y las utilidades de usr\bin\."
$gitGlobal = "Instalador de Git for Windows (Git-2.x-64-bit.exe), que es además el bash que Claude Code usa en Windows. Sin internet: copia el instalador; admite instalación desatendida con '/VERYSILENT /NORESTART'."
$gitGet = "https://github.com/git-for-windows/git/releases/latest -> PortableGit-2.x-64-bit.7z.exe (repo) o Git-2.x-64-bit.exe (global). Con winget: 'winget download Git.Git'."
if ($GitExe) {
  $estado = 'OK'; if ($GitSource -eq 'vendor') { $estado = 'OK (vendor)' }
  Add-Result 'git' 'binario' $estado "$GitVersion en $GitExe"
} else {
  Add-Result 'git' 'binario' 'FALTA' 'No hay git: lo necesitan el arranque de sesión, el motor del wiki, las puertas del ciclo (branch-change.mjs) y la suite de aceptación' $gitRepo $gitGlobal $gitGet
}

# bash de Git for Windows (el arranque de sesión y los hooks son scripts bash)
$GitBash = $null
if ($GitRoot) {
  foreach ($rel in @('bin\bash.exe', 'usr\bin\bash.exe')) {
    $p = Join-Path $GitRoot $rel
    if (Test-Path $p) { $GitBash = $p; break }
  }
}
if ($env:CLAUDE_CODE_GIT_BASH_PATH -and (Test-Path $env:CLAUDE_CODE_GIT_BASH_PATH)) { $GitBash = $env:CLAUDE_CODE_GIT_BASH_PATH }
if ($GitBash) {
  Add-Result 'bash (Git Bash)' 'binario' 'OK' "$GitBash"
} else {
  Add-Result 'bash (Git Bash)' 'binario' 'FALTA' 'No hay bash de Git for Windows: el arranque (.agents\hooks\session-bootstrap.sh) y los hooks de Claude Code son scripts bash' $gitRepo $gitGlobal $gitGet
}

# El primer "bash" del PATH es el que lanza el plugin de OpenCode (spawn("bash"))
$pathBash = @(Find-Exe 'bash')
if ($pathBash.Count -gt 0 -and $pathBash[0] -match '\\(System32|WindowsApps)\\') {
  Add-Result 'bash en el PATH' 'configuración' 'AVISO' "El primer bash del PATH es $($pathBash[0]) (WSL), no Git Bash: el plugin de OpenCode ejecutaría el arranque en WSL" `
    "Que los adaptadores llamen a la ruta del bash de $VendorRel\git\bin\bash.exe en vez de a 'bash'." `
    "Poner '<Git>\bin' por delante de C:\Windows\System32 en el PATH del usuario, o desinstalar WSL si no se usa."
} elseif ($pathBash.Count -eq 0 -and $GitBash) {
  Add-Result 'bash en el PATH' 'configuración' 'AVISO' "bash no está en el PATH: Claude Code lo encuentra junto a git, pero el plugin de OpenCode (spawn(""bash"")) no" `
    "Que el adaptador de OpenCode use la ruta de $VendorRel\git\bin\bash.exe." `
    "Añadir '$(Split-Path $GitBash)' al PATH del usuario."
} elseif ($pathBash.Count -gt 0) {
  Add-Result 'bash en el PATH' 'configuración' 'OK' "$($pathBash[0])"
}

# Utilidades que usan el arranque y la suite (acceptance-tests\support\machine.js)
$tools = 'cat', 'dirname', 'grep', 'head', 'ln', 'mkdir', 'mktemp', 'mv', 'readlink', 'rm', 'sed', 'sha256sum', 'sort', 'tail', 'timeout', 'wc'
if ($GitRoot) {
  $usrBin = Join-Path $GitRoot 'usr\bin'
  $missing = @($tools | Where-Object { -not (Test-Path (Join-Path $usrBin "$_.exe")) })
  if ($missing.Count -eq 0) { Add-Result 'coreutils de Git Bash' 'binario' 'OK' "$usrBin ($($tools.Count) utilidades)" }
  else { Add-Result 'coreutils de Git Bash' 'binario' 'FALTA' ("Faltan en ${usrBin}: " + ($missing -join ', ')) $gitRepo $gitGlobal $gitGet }
}

# ln -s en Git Bash copia en vez de enlazar si MSYS no pide symlinks nativos
$msys = [Environment]::GetEnvironmentVariable('MSYS')
if ($msys -match 'winsymlinks:native') {
  Add-Result 'MSYS=winsymlinks' 'configuración' 'OK' "MSYS=$msys"
} else {
  Add-Result 'MSYS=winsymlinks' 'configuración' 'AVISO' "MSYS no incluye winsymlinks:nativestrict: 'ln -s' en Git Bash crea copias, y el arranque no reconocerá después los enlaces del motor del wiki" `
    "Que el arranque exporte MSYS=winsymlinks:nativestrict antes de enlazar el motor." `
    "Variable de entorno de usuario: [Environment]::SetEnvironmentVariable('MSYS','winsymlinks:nativestrict','User')"
}

# --- 3. Symlinks del repositorio --------------------------------------------

$devMode = $false
try {
  $v = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -Name AllowDevelopmentWithoutDevLicense -ErrorAction Stop
  $devMode = ($v.AllowDevelopmentWithoutDevLicense -eq 1)
} catch { }
$canLink = $false
$probe = Join-Path ([IO.Path]::GetTempPath()) ("idd-link-" + [guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Path "$probe\t" | Out-Null
  # mklink (y no New-Item, que en Windows PowerShell 5.1 exige administrador
  # aunque esté el Modo de desarrollador) crea el enlace como lo haría git
  $null = cmd /c mklink /D "$probe\l" "$probe\t" 2>&1
  $canLink = ($LASTEXITCODE -eq 0)
} catch { } finally {
  # Primero el enlace, con rmdir, para no recorrerlo al borrar
  if (Test-Path "$probe\l") { $null = cmd /c rmdir "$probe\l" 2>&1 }
  Remove-Item $probe -Recurse -Force -ErrorAction SilentlyContinue
}
$linkGlobal = "Activar el Modo de desarrollador (Configuración > Sistema > Para programadores), que permite crear symlinks sin ser administrador, y 'git config --global core.symlinks true'."
if ($canLink) { Add-Result 'Crear symlinks' 'configuración' 'OK' "Se pueden crear symlinks (Modo de desarrollador: $devMode)" }
else {
  Add-Result 'Crear symlinks' 'configuración' 'FALTA' "Este usuario no puede crear symlinks: el arranque no podrá exponer el motor del wiki a los agentes" `
    "No hay alternativa en el repo: los enlaces .claude\skills\* y los del motor son symlinks por diseño (ADR-0003, ADR-0005)." $linkGlobal
}

$symlinkCfg = $null
if ($GitExe) { $symlinkCfg = Invoke-Quiet $GitExe @('-C', $ProjectDir, 'config', '--get', 'core.symlinks') }
$sample = Join-Path $ProjectDir '.claude\skills\grill-me'
$isLink = $false
if (Test-Path $sample) {
  $it = Get-Item $sample -Force
  $isLink = [bool]($it.Attributes -band [IO.FileAttributes]::ReparsePoint)
}
if ($isLink) { Add-Result 'Symlinks del clon' 'configuración' 'OK' ".claude\skills\* son symlinks (core.symlinks=$symlinkCfg)" }
else {
  Add-Result 'Symlinks del clon' 'configuración' 'FALTA' ".claude\skills\grill-me no es un symlink (core.symlinks=$symlinkCfg): git lo ha escrito como un archivo de texto y Claude Code no verá las skills del schema" `
    "Nada que incorporar: hay que volver a extraer el clon con symlinks." `
    ("$linkGlobal Después: 'git -C ""$ProjectDir"" config core.symlinks true' y 'git -C ""$ProjectDir"" checkout -- .claude .opencode'.")
}

# --- 4. Python 3 (helper del motor del wiki, bin/llm-wiki) -------------------

$pyRepo = "Python embeddable (zip) descomprimido en $VendorRel\python\, con una copia de python.exe llamada python3.exe (el helper bin/llm-wiki usa '#!/usr/bin/env python3')."
$pyGlobal = "Instalador de python.org 3.12 o superior para $NodeCpu ('/quiet InstallAllUsers=1 PrependPath=1'). No crea python3.exe: hace falta un alias python3 en Git Bash o una copia de python.exe como python3.exe."
$pyGet = "https://www.python.org/downloads/windows/ -> python-3.12.x-embed-amd64.zip (repo) o python-3.12.x-amd64.exe (global). Con winget: 'winget download Python.Python.3.12'."
$pyFound = $null; $py3Found = $null
$pyCands = @()
foreach ($n in @('python3.exe', 'python.exe')) { $p = Join-Path $VendorPython $n; if (Test-Path $p) { $pyCands += , @($p, 'vendor') } }
foreach ($p in Find-Exe @('python3', 'python', 'py')) { if (-not (Test-StoreStub $p)) { $pyCands += , @($p, 'PATH') } }
foreach ($c in $pyCands) {
  $args_ = @('--version'); if ((Split-Path $c[0] -Leaf) -eq 'py.exe') { $args_ = @('-3', '--version') }
  $out = Invoke-Quiet $c[0] $args_
  $v = Get-Version $out
  if ($v -and $v.Major -eq 3 -and $v.Minor -ge 8) {
    if (-not $pyFound) { $pyFound = $c; $pyVersion = $v }
    if ((Split-Path $c[0] -Leaf) -eq 'python3.exe') { $py3Found = $c; break }
  }
}
if ($pyFound) {
  $estado = 'OK'; if ($pyFound[1] -eq 'vendor') { $estado = 'OK (vendor)' }
  Add-Result 'Python 3' 'binario' $estado "Python $pyVersion en $($pyFound[0])"
  if (-not $py3Found) {
    Add-Result 'python3 (nombre)' 'configuración' 'AVISO' "No hay ningún python3.exe real (solo python/py o el alias de la Store): '#!/usr/bin/env python3' de bin/llm-wiki fallará en Git Bash" `
      "Incluir python3.exe (copia de python.exe) en $VendorRel\python\." `
      "Copiar python.exe como python3.exe en su carpeta, o desactivar el alias de la Store (Configuración > Aplicaciones > Alias de ejecución de aplicaciones) y crear el alias en ~/.bashrc."
  }
} else {
  Add-Result 'Python 3' 'binario' 'FALTA' 'No hay Python 3.8+ (el alias de la Microsoft Store no cuenta): lo necesita el helper determinista del motor del wiki (lint, checkpoints...). Los workflows del wiki funcionan sin él.' $pyRepo $pyGlobal $pyGet
}

# --- 5. Motor del wiki (nvk/llm-wiki) ---------------------------------------

$engineJson = Join-Path $ProjectDir '.agents\wiki\engine.json'
if (Test-Path $engineJson) {
  $eng = Read-Json $engineJson
  $repo = Get-Prop $eng 'repo'; $ref = Get-Prop $eng 'ref'
  $want = "$ref $repo"
  $stamp = Join-Path $ProjectDir '.agents\wiki-engine\.wiki-engine-ref'
  $have = $null; if (Test-Path $stamp) { $have = ([IO.File]::ReadAllText($stamp)).Trim() }
  $bundleName = "llm-wiki-$ref.bundle"
  $bundle = Join-Path $VendorDir $bundleName
  $isLocal = -not ($repo -match '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') -and -not ($repo -match '^(https?|ssh|git)://|^git@')
  $engRepo = "Un git bundle con el tag $ref en $VendorRel\$bundleName, y en .agents\wiki\engine.json ""repo"": ""$($VendorRel.Replace('\','/'))/$bundleName"" (el arranque admite cualquier URL de git, y 'git clone --branch $ref' funciona con un bundle)."
  $engGlobal = "Un clon compartido en la máquina (p. ej. C:\offline\llm-wiki.git, 'git clone --mirror') y, en engine.json, ""repo"": ""C:/offline/llm-wiki.git"". O instalarlo a mano en .agents\wiki-engine\ con el comando que da el arranque."
  $engGet = "git clone --mirror https://github.com/$repo.git llm-wiki.git; git -C llm-wiki.git bundle create ..\$bundleName $ref"
  if ($have -eq $want) {
    Add-Result "Motor del wiki ($repo $ref)" 'datos' 'OK' "Instalado en .agents\wiki-engine\"
  } elseif (Test-Path $bundle) {
    $st = 'OK (vendor)'; $det = "$bundle existe"
    if (-not $isLocal) { $st = 'AVISO'; $det += ", pero engine.json aún apunta a '$repo' (GitHub): sin internet el arranque no lo usará" }
    Add-Result "Motor del wiki ($repo $ref)" 'datos' $st $det $engRepo $engGlobal $engGet
  } elseif ($isLocal -and $GitExe -and (Invoke-Quiet $GitExe @('-C', $ProjectDir, 'ls-remote', $repo, $ref))) {
    Add-Result "Motor del wiki ($ref)" 'datos' 'OK' "engine.json apunta a una fuente local accesible: $repo"
  } else {
    $det = "No está instalado (sello: '$have', se espera '$want') y engine.json apunta a '$repo', que sin internet no se puede clonar"
    Add-Result "Motor del wiki ($repo $ref)" 'datos' 'FALTA' $det $engRepo $engGlobal $engGet
  }
} else {
  Add-Result 'Motor del wiki' 'datos' 'OK' 'No hay .agents\wiki\engine.json: el proyecto no usa el motor'
}

# --- 6. Dependencias npm (raíz y acceptance-tests) ---------------------------

$globalCache = $null
if ($NpmCmd) { $globalCache = Invoke-Quiet $NpmCmd @('config', 'get', 'cache') }
if (-not $globalCache) { $globalCache = Join-Path $env:LOCALAPPDATA 'npm-cache' }
$npmOffline = $null
if ($NpmCmd) { $npmOffline = Invoke-Quiet $NpmCmd @('config', 'get', 'offline') }

function Test-NpmProject {
  param([string]$Dir, [string]$Label)
  $lockPath = Join-Path $Dir 'package-lock.json'
  if (-not (Test-Path $lockPath)) { return }
  $lock = Read-Json $lockPath
  $total = 0; $installed = 0; $inVendor = 0; $inGlobal = 0
  $absent = @(); $platformPkgs = @()
  foreach ($prop in $lock.packages.PSObject.Properties) {
    $key = $prop.Name; $p = $prop.Value
    if ($key -notlike 'node_modules/*' -and $key -notlike '*/node_modules/*') { continue }
    if ((Get-Prop $p 'link') -or (Get-Prop $p 'inBundle')) { continue }
    if (-not (Test-Platform (Get-Prop $p 'os') $NodeOs)) { continue }
    if (-not (Test-Platform (Get-Prop $p 'cpu') $NodeCpu)) { continue }
    $total++
    $ver = Get-Prop $p 'version'
    $name = $key.Substring($key.LastIndexOf('node_modules/') + 13)
    if ((Get-Prop $p 'os') -or (Get-Prop $p 'cpu')) { $platformPkgs += "$name@$ver" }
    $pj = Join-Path $Dir ($key.Replace('/', '\') + '\package.json')
    if (Test-Path $pj) {
      try { if ((Read-Json $pj).version -eq $ver) { $installed++; continue } } catch { }
    }
    $integ = Get-Prop $p 'integrity'
    $vp = $null; $gp = $null
    if ($integ) { $vp = Get-CacachePath $VendorCache $integ; $gp = Get-CacachePath $globalCache $integ }
    if ($vp -and (Test-Path $vp)) { $inVendor++; continue }
    if ($gp -and (Test-Path $gp)) { $inGlobal++; continue }
    $absent += "$name@$ver"
  }
  $rel = $Dir.Substring($ProjectDir.Length).TrimStart('\'); if (-not $rel) { $rel = '.' }
  $plat = ''; if ($platformPkgs) { $plat = " Con binario propio de $NodeOs-${NodeCpu}: " + ($platformPkgs -join ', ') + '.' }
  $offNote = ''
  if ($inGlobal -gt 0 -and $npmOffline -ne 'true') { $offNote = " La caché global los tiene, pero npm no está en modo offline (npm config get offline = $npmOffline): 'npm install' del arranque intentará la red." }
  $repoTxt = "Una caché de npm ($VendorRel\npm-cache\_cacache) con los $total paquetes de $rel\package-lock.json para $NodeOs-$NodeCpu, y que el arranque instale con 'npm install --offline --cache <ruta absoluta de $VendorRel\npm-cache>'. Alternativa: versionar $rel\node_modules\ instalado en Windows (no sirve el de Linux).$plat"
  $globalTxt = "Llenar la caché global de npm ($globalCache) con esos paquetes y fijar 'npm config set offline true' (o prefer-offline) a nivel de usuario: el 'npm install' del arranque los toma de ahí sin cambiar el repo."
  if ($Label -eq 'raíz') { $globalTxt += " Para el CLI: 'npm install -g --offline @fission-ai/openspec@1.17.0' con la caché llena (el arranque seguirá queriendo node_modules\ local)." }
  $getTxt = "En una máquina Windows $NodeCpu con internet: copiar $rel\package.json y package-lock.json a una carpeta vacía y ejecutar 'npm ci --cache <carpeta>\npm-cache --no-audit --no-fund' (en Windows, para que baje los binarios win32), y copiar <carpeta>\npm-cache."
  $detail = "$total paquetes para ${NodeOs}-${NodeCpu}: $installed instalados en $rel\node_modules, $inVendor en la caché del vendor, $inGlobal en la caché global."
  if ($absent.Count -eq 0) {
    $estado = 'OK'
    if ($installed -lt $total -and $inVendor -gt 0) { $estado = 'OK (vendor)' }
    if ($installed -lt $total -and $inGlobal -gt 0 -and $npmOffline -ne 'true') { $estado = 'AVISO' }
    Add-Result "Dependencias npm ($Label)" 'datos' $estado ($detail + $offNote) $repoTxt $globalTxt $getTxt
  } else {
    $show = ($absent | Select-Object -First 8) -join ', '
    if ($absent.Count -gt 8) { $show += ", ... (+$($absent.Count - 8))" }
    Add-Result "Dependencias npm ($Label)" 'datos' 'FALTA' "$detail Faltan $($absent.Count): $show" $repoTxt $globalTxt $getTxt
  }
}

Test-NpmProject $ProjectDir 'raíz'
$at = Join-Path $ProjectDir 'acceptance-tests'
if (Test-Path (Join-Path $at 'package.json')) { Test-NpmProject $at 'acceptance-tests' }

# --- 7. Agente (Claude Code u OpenCode 2) ------------------------------------

$claude = @(Find-Exe 'claude'); $opencode = @(Find-Exe 'opencode')
$vendorOc = Join-Path $VendorDir 'opencode\opencode.exe'
if (Test-Path $vendorOc) { $opencode = @($vendorOc) + $opencode }
$agents = @()
if ($claude.Count -gt 0) { $v = Invoke-Quiet $claude[0] @('--version'); $agents += "Claude Code $v ($($claude[0]))" }
if ($opencode.Count -gt 0) {
  $v = Invoke-Quiet $opencode[0] @('--version'); $agents += "OpenCode $v ($($opencode[0]))"
  $ov = Get-Version $v
  if ($ov -and $ov.Major -lt 2) { Add-Result 'OpenCode' 'binario' 'AVISO' "OpenCode ${v}: el proyecto solo admite OpenCode 2 o superior" }
}
$agNote = 'Ojo: cualquiera de los dos necesita llegar al proveedor del modelo; sin internet solo es viable OpenCode con un modelo local (p. ej. un servidor compatible con OpenAI en la LAN).'
if ($agents) { Add-Result 'Agente' 'binario' 'OK' (($agents -join '; ') + '. ' + $agNote) }
else {
  Add-Result 'Agente' 'binario' 'FALTA' "No hay ni Claude Code ni OpenCode en el PATH. $agNote" `
    "opencode.exe (binario único, versión 2.x) en $VendorRel\opencode\." `
    "Claude Code: instalador nativo o 'npm install -g @anthropic-ai/claude-code' con la caché llena. OpenCode: copiar opencode.exe a una carpeta del PATH." `
    "Claude Code: https://claude.com/claude-code. OpenCode: https://github.com/sst/opencode/releases (opencode-windows-$NodeCpu.zip)."
}

# --- Informe ----------------------------------------------------------------

$missing = @($Results | Where-Object { $_.Estado -eq 'FALTA' })
if ($Json) {
  [pscustomobject]@{
    proyecto   = $ProjectDir
    vendor     = $VendorDir
    plataforma = "$NodeOs-$NodeCpu"
    resultados = $Results
  } | ConvertTo-Json -Depth 4
} else {
  Write-Host ''
  Write-Host "Instalación offline en Windows: $ProjectDir ($NodeOs-$NodeCpu)" -ForegroundColor Cyan
  Write-Host "Vendor del repo: $VendorDir"
  Write-Host ''
  $Results | Format-Table Estado, Tipo, Componente, Detalle -AutoSize -Wrap | Out-String -Width 220 | Write-Host
  $todo = @($Results | Where-Object { $_.Estado -in 'FALTA', 'AVISO' })
  if ($todo.Count -gt 0) {
    Write-Host 'Qué hacer con lo que falta o tiene avisos' -ForegroundColor Cyan
    foreach ($r in $todo) {
      $color = 'Yellow'; if ($r.Estado -eq 'FALTA') { $color = 'Red' }
      Write-Host ''
      Write-Host "[$($r.Estado)] $($r.Componente) ($($r.Tipo))" -ForegroundColor $color
      Write-Host "  Detalle : $($r.Detalle)"
      if ($r.Repo)    { Write-Host "  Repo    : $($r.Repo)" }
      if ($r.Global)  { Write-Host "  Global  : $($r.Global)" } elseif ($r.Estado -eq 'FALTA') { Write-Host '  Global  : no hay alternativa global' }
      if ($r.Obtener) { Write-Host "  Obtener : $($r.Obtener)" }
    }
    Write-Host ''
  }
  if ($missing.Count -eq 0) { Write-Host 'No falta nada para una instalación completa sin internet.' -ForegroundColor Green }
  else { Write-Host "Faltan $($missing.Count) componentes." -ForegroundColor Red }
}

if ($missing.Count -gt 0) { exit 1 }
exit 0
