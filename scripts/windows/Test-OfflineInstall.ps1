<#
.SYNOPSIS
  Diagnostica qué le falta a esta máquina Windows 11 para que el proyecto
  funcione en ella, también sin acceso a internet.

.DESCRIPTION
  Comprueba cada binario, dato y ajuste que necesita el proyecto (Node.js y
  npm, git, Python 3, los finales de línea del clon, el motor del wiki, las
  dependencias npm de la raíz y de acceptance-tests/ y el agente, OpenCode 2)
  y, en un proyecto de la variante adelgazada, la instalación global de
  <data> y <config> (design D8 de windows-global-distro). Para lo que falta,
  dice:

    - Repo:    qué habría que incorporar al repositorio (bajo vendor\windows\,
               por defecto) para no depender de la máquina.
    - Global:  la alternativa de instalarlo globalmente en la máquina, si existe.
    - Obtener: cómo conseguirlo en una máquina CON internet.

  No instala ni cambia nada, y no usa la red. Lo que esté en el directorio de
  vendor cuenta como presente ("OK (vendor)").

  Tiene dos partes (design D4 de windows-support): Get-ReadinessFacts recoge
  los hechos de la máquina, sin decidir nada, y Get-ReadinessReport los
  convierte en el informe, sin tocar la máquina. Con -FactsFile se evalúan
  unos hechos dados, sin recogerlos: así prueba la suite de aceptación la
  evaluación fuera de Windows.

.PARAMETER ProjectDir
  Raíz del proyecto. Por defecto, dos niveles por encima de este script.

.PARAMETER VendorDir
  Directorio del repositorio donde se incorporarían los binarios y datos.
  Por defecto, <ProjectDir>\vendor\windows.

.PARAMETER Json
  Devuelve el informe como JSON en vez de como texto.

.PARAMETER FactsFile
  Un JSON con los hechos de una máquina, en el formato de Get-ReadinessFacts.
  Se evalúan en lugar de recoger los de esta máquina.

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
  [switch]$Json,
  [string]$FactsFile
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

# --- Utilidades comunes ------------------------------------------------------

# Una propiedad de un objeto (PSCustomObject o hashtable), o $null si no la tiene
function P {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return $null }
  if ($Object -is [System.Collections.IDictionary]) {
    if ($Object.Contains($Name)) { return $Object[$Name] }
    return $null
  }
  $prop = $Object.PSObject.Properties[$Name]
  if ($prop) { return $prop.Value }
  return $null
}

function Get-Version {
  param([string]$Text)
  if ($Text -and $Text -match '(\d+)\.(\d+)(?:\.(\d+))?') {
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

# =============================================================================
# Recogida de hechos: lee la máquina y el proyecto, sin decidir nada
# =============================================================================

# Ejecuta un programa y devuelve su salida (stdout+stderr) recortada, o $null si falla
function Invoke-Quiet {
  param([string]$Exe, [string[]]$Arguments)
  # En Windows PowerShell 5.1, con Stop, cualquier línea en stderr sería un error
  $ErrorActionPreference = 'Continue'
  try {
    $out = & $Exe @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { return $null }
    return $out.Trim()
  } catch { return $null }
}

# Todas las rutas del PATH para unos nombres
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

# Los alias de ejecución de la Microsoft Store son archivos vacíos en WindowsApps
function Test-StoreStub {
  param([string]$Path)
  if ($Path -notmatch '\\WindowsApps\\') { return $false }
  try { return ((Get-Item $Path -Force).Length -eq 0) } catch { return $true }
}

# integrity de npm (sha512-<base64>) -> ruta en content-v2 de un cacache
function Get-CacachePath {
  param([string]$CacheRoot, [string]$Integrity)
  if (-not $CacheRoot -or $Integrity -notmatch '^(sha\d+)-(.+)$') { return $null }
  $algo = $Matches[1]
  try { $bytes = [Convert]::FromBase64String(($Matches[2] -split '\s')[0]) } catch { return $null }
  $hex = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  return Join-Path $CacheRoot ("_cacache\content-v2\{0}\{1}\{2}\{3}" -f $algo, $hex.Substring(0, 2), $hex.Substring(2, 2), $hex.Substring(4))
}

function Get-NpmPackagesFacts {
  param([string]$Dir, [string]$VendorCache, [string]$GlobalCache)
  $lockPath = Join-Path $Dir 'package-lock.json'
  if (-not (Test-Path $lockPath)) { return $null }
  $lock = Read-Json $lockPath
  $packages = @()
  foreach ($prop in (P $lock 'packages').PSObject.Properties) {
    $key = $prop.Name; $p = $prop.Value
    if ($key -notlike 'node_modules/*' -and $key -notlike '*/node_modules/*') { continue }
    if ((P $p 'link') -or (P $p 'inBundle')) { continue }
    $version = P $p 'version'
    $installed = $false
    $pj = Join-Path $Dir ($key.Replace('/', '\') + '\package.json')
    if (Test-Path $pj) {
      try { $installed = ((P (Read-Json $pj) 'version') -eq $version) } catch { }
    }
    $integrity = P $p 'integrity'
    $vp = $null; $gp = $null
    if ($integrity) { $vp = Get-CacachePath $VendorCache $integrity; $gp = Get-CacachePath $GlobalCache $integrity }
    $packages += [ordered]@{
      name          = $key.Substring($key.LastIndexOf('node_modules/') + 13)
      version       = $version
      os            = @(P $p 'os')
      cpu           = @(P $p 'cpu')
      installed     = $installed
      inVendorCache = [bool]($vp -and (Test-Path $vp))
      inGlobalCache = [bool]($gp -and (Test-Path $gp))
    }
  }
  return $packages
}

function Get-ReadinessFacts {
  param([string]$ProjectDir, [string]$VendorDir, [string]$VendorRel)
  $vendorNode = Join-Path $VendorDir 'node'
  $vendorGit = Join-Path $VendorDir 'git'
  $vendorPython = Join-Path $VendorDir 'python'
  $vendorCache = Join-Path $VendorDir 'npm-cache'

  $cpu = 'x64'
  switch ($env:PROCESSOR_ARCHITECTURE) { 'ARM64' { $cpu = 'arm64' } 'x86' { $cpu = 'ia32' } }

  # Node.js: el del vendor primero, después los del PATH
  $required = P (P (Read-Json (Join-Path $ProjectDir 'package.json')) 'engines') 'node'
  $nodes = @()
  $vendorExe = Join-Path $vendorNode 'node.exe'
  if (Test-Path $vendorExe) { $nodes += [ordered]@{ path = $vendorExe; source = 'vendor'; version = (Invoke-Quiet $vendorExe @('--version')) } }
  foreach ($p in Find-Exe 'node') { $nodes += [ordered]@{ path = $p; source = 'PATH'; version = (Invoke-Quiet $p @('--version')) } }

  # npm y npx: junto al primer Node.js o en el PATH
  $tool = {
    param($name)
    foreach ($n in $nodes) {
      $c = Join-Path (Split-Path $n.path) "$name.cmd"
      if (Test-Path $c) { return $c }
    }
    $f = @(Find-Exe $name)
    if ($f.Count -gt 0) { return $f[0] }
    return $null
  }
  $npmPath = & $tool 'npm'
  $npxPath = & $tool 'npx'
  $globalCache = $null; $offline = $null
  if ($npmPath) {
    $globalCache = Invoke-Quiet $npmPath @('config', 'get', 'cache')
    $offline = Invoke-Quiet $npmPath @('config', 'get', 'offline')
  }
  if (-not $globalCache -and $env:LOCALAPPDATA) { $globalCache = Join-Path $env:LOCALAPPDATA 'npm-cache' }

  # git: el del vendor primero
  $git = [ordered]@{ path = $null; source = $null; version = $null }
  $gits = @()
  foreach ($rel in @('cmd\git.exe', 'bin\git.exe', 'mingw64\bin\git.exe')) {
    $p = Join-Path $vendorGit $rel
    if (Test-Path $p) { $gits += , @($p, 'vendor'); break }
  }
  foreach ($p in Find-Exe 'git') { $gits += , @($p, 'PATH') }
  foreach ($c in $gits) {
    $out = Invoke-Quiet $c[0] @('--version')
    if ($out -match 'git version') { $git = [ordered]@{ path = $c[0]; source = $c[1]; version = $out }; break }
  }

  # Python 3, con los alias de la Microsoft Store marcados
  $pythons = @()
  foreach ($n in @('python3.exe', 'python.exe')) {
    $p = Join-Path $vendorPython $n
    if (Test-Path $p) { $pythons += [ordered]@{ path = $p; source = 'vendor'; version = (Invoke-Quiet $p @('--version')); storeAlias = $false } }
  }
  foreach ($p in Find-Exe @('python3', 'python', 'py')) {
    if (Test-StoreStub $p) { $pythons += [ordered]@{ path = $p; source = 'PATH'; version = $null; storeAlias = $true }; continue }
    $a = @('--version'); if ((Split-Path $p -Leaf) -eq 'py.exe') { $a = @('-3', '--version') }
    $pythons += [ordered]@{ path = $p; source = 'PATH'; version = (Invoke-Quiet $p $a); storeAlias = $false }
  }

  # Archivos de texto versionados extraídos con CRLF
  $lineEndings = [ordered]@{ checked = $false; crlf = @() }
  if ($git.path) {
    $eol = Invoke-Quiet $git.path @('-C', $ProjectDir, 'ls-files', '--eol')
    if ($null -ne $eol) {
      $crlf = @()
      foreach ($line in ($eol -split "`r?`n")) {
        if ($line -match '\bw/crlf\b' -and $line -match '\t(.+)$') { $crlf += $Matches[1] }
      }
      $lineEndings = [ordered]@{ checked = $true; crlf = $crlf }
    }
  }

  # Motor del wiki
  $engine = [ordered]@{ configured = $false }
  $engineJson = Join-Path $ProjectDir '.agents\wiki\engine.json'
  if (Test-Path $engineJson) {
    $eng = Read-Json $engineJson
    $repo = P $eng 'repo'; $ref = P $eng 'ref'
    $stamp = Join-Path $ProjectDir '.agents\wiki-engine\.wiki-engine-ref'
    $installedRef = $null; if (Test-Path $stamp) { $installedRef = ([IO.File]::ReadAllText($stamp)).Trim() }
    $local = -not ($repo -match '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') -and -not ($repo -match '^(https?|ssh|git)://|^git@')
    $localHasRef = $false
    if ($local -and $git.path) { $localHasRef = [bool](Invoke-Quiet $git.path @('-C', $ProjectDir, 'ls-remote', $repo, $ref)) }
    $engine = [ordered]@{ configured = $true; repo = $repo; ref = $ref; installedRef = $installedRef; local = $local; localHasRef = $localHasRef }
  }

  # Dependencias npm de la raíz y de acceptance-tests/
  $npmProjects = @()
  foreach ($proj in @(@('raíz', '.'), @('acceptance-tests', 'acceptance-tests'))) {
    $dir = $ProjectDir; if ($proj[1] -ne '.') { $dir = Join-Path $ProjectDir $proj[1] }
    $packages = Get-NpmPackagesFacts $dir $vendorCache $globalCache
    if ($null -ne $packages) { $npmProjects += [ordered]@{ label = $proj[0]; rel = $proj[1]; packages = @($packages) } }
  }

  # La instalación global (windows-global-distro, design D8): <data> y
  # <config> como los calcula el .bat, y lo que instala
  $ownSchema = Test-Path (Join-Path $ProjectDir 'openspec\schemas\intent-driven\schema.yaml')
  $gData = $env:XDG_DATA_HOME; if (-not $gData) { $gData = $env:LOCALAPPDATA }
  $gConfig = $env:XDG_CONFIG_HOME; if (-not $gConfig -and $env:USERPROFILE) { $gConfig = Join-Path $env:USERPROFILE '.config' }
  $gVersion = $null
  if ($gData) {
    $vf = Join-Path $gData 'idd\version'
    if (Test-Path $vf) { $gVersion = ([IO.File]::ReadAllText($vf)).Trim() }
  }
  $gItems = @()
  foreach ($i in @(
      @('schema intent-driven', 'data', @('openspec\schemas\intent-driven\schema.yaml')),
      @('motor del wiki', 'data', @('idd\wiki-engine\claude-plugin')),
      @('skill openspec-git-discipline', 'config', @('opencode\skills\openspec-git-discipline\SKILL.md', 'opencode\skills\openspec-git-discipline\scripts\branch-change.mjs')),
      @('skill wiki-query', 'config', @('opencode\skills\wiki-query\SKILL.md')),
      @('skill wiki-manager', 'config', @('opencode\skills\wiki-manager\SKILL.md')),
      @('plugin openspec-autopilot', 'config', @('opencode\plugins\openspec-autopilot\server.js')),
      @('plugin session-bootstrap', 'config', @('opencode\plugins\session-bootstrap\server.js')),
      @('plugin response-comments', 'config', @('opencode\plugins\response-comments\server.js')))) {
    $root = $gConfig; if ($i[1] -eq 'data') { $root = $gData }
    $present = [bool]$root
    foreach ($rel in $i[2]) { if ($present -and -not (Test-Path (Join-Path $root $rel))) { $present = $false } }
    $gItems += [ordered]@{ name = $i[0]; present = $present }
  }

  # Agentes
  $agents = [ordered]@{ opencode = @(); claude = @() }
  $opencodes = @()
  $vendorOc = Join-Path $VendorDir 'opencode\opencode.exe'
  if (Test-Path $vendorOc) { $opencodes += $vendorOc }
  $opencodes += Find-Exe 'opencode'
  foreach ($p in $opencodes) { $agents.opencode += [ordered]@{ path = $p; version = (Invoke-Quiet $p @('--version')) } }
  foreach ($p in Find-Exe 'claude') { $agents.claude += [ordered]@{ path = $p; version = (Invoke-Quiet $p @('--version')) } }

  return [ordered]@{
    version     = 1
    platform    = [ordered]@{ os = 'win32'; cpu = $cpu }
    vendorRel   = $VendorRel
    node        = [ordered]@{ required = $required; candidates = $nodes }
    npm         = [ordered]@{ path = $npmPath; offline = $offline; globalCache = $globalCache }
    npx         = [ordered]@{ path = $npxPath }
    git         = $git
    python      = [ordered]@{ candidates = $pythons }
    lineEndings = $lineEndings
    engine      = $engine
    npmProjects = $npmProjects
    agents      = $agents
    project     = [ordered]@{ ownSchema = $ownSchema }
    global      = [ordered]@{ data = $gData; config = $gConfig; version = $gVersion; items = $gItems }
  }
}

# =============================================================================
# Evaluación: convierte los hechos en el informe, sin tocar la máquina
# =============================================================================

function New-Result {
  param([string]$Id, [string]$Componente, [string]$Tipo, [string]$Estado, [string]$Detalle,
    [string]$Repo = '', [string]$Global = '', [string]$Obtener = '')
  return [pscustomobject][ordered]@{
    Id = $Id; Componente = $Componente; Tipo = $Tipo; Estado = $Estado; Detalle = $Detalle
    Repo = $Repo; Global = $Global; Obtener = $Obtener
  }
}

# El paquete del lockfile se instala en esta plataforma (campos os/cpu)
function Test-Platform {
  param($Values, [string]$Current)
  $list = @($Values | Where-Object { $_ })
  if ($list.Count -eq 0) { return $true }
  $neg = @($list | Where-Object { $_ -like '!*' })
  $pos = @($list | Where-Object { $_ -notlike '!*' })
  if ($neg -contains "!$Current") { return $false }
  if ($pos.Count -gt 0 -and -not ($pos -contains $Current)) { return $false }
  return $true
}

function Get-ReadinessReport {
  param($Facts)
  $results = New-Object System.Collections.Generic.List[object]
  $os = P (P $Facts 'platform') 'os'; $cpu = P (P $Facts 'platform') 'cpu'
  $v = P $Facts 'vendorRel'
  $noGlobal = 'No hay alternativa global.'

  # --- Node.js, npm y npx ---
  $node = P $Facts 'node'
  $required = P $node 'required'
  $min = $null
  if ($required -match '>=\s*v?(\d+(?:\.\d+){0,2})') { $min = Get-Version $Matches[1] }
  if (-not $min) { $min = New-Object Version -ArgumentList @(22, 12, 0) }
  $nodeRepo = "Node.js portable (zip) descomprimido en $v\node\ (node.exe, npm.cmd, npx.cmd, node_modules\npm), por delante en el PATH de la sesión."
  $nodeGlobal = "Instalador MSI de Node.js $min o superior (LTS 22.x o 24.x) para $cpu, que añade node y npm al PATH. Sin internet: copia el .msi y ejecuta 'msiexec /i node-v22.x.y-$cpu.msi'."
  $nodeGet = "https://nodejs.org/dist/latest-v22.x/ -> node-v22.x.y-win-$cpu.zip (repo) o node-v22.x.y-$cpu.msi (global). Con winget: 'winget download OpenJS.NodeJS.LTS'."
  $good = $null; $found = @()
  foreach ($c in @(P $node 'candidates')) {
    if ($null -eq $c) { continue }
    $ver = Get-Version (P $c 'version')
    if ($ver -and $ver -ge $min) { $good = $c; $goodVer = $ver; break }
    if ($ver) { $found += "$(P $c 'path') es $ver" }
  }
  if ($good) {
    $st = 'OK'; if ((P $good 'source') -eq 'vendor') { $st = 'OK (vendor)' }
    $results.Add((New-Result 'node' 'Node.js' 'binario' $st "node $goodVer en $(P $good 'path') (requiere $required)"))
  } else {
    $det = "No hay Node.js $required (requisito de package.json)"
    if ($found.Count -gt 0) { $det += '. Encontrado: ' + ($found -join '; ') }
    $results.Add((New-Result 'node' 'Node.js' 'binario' 'FALTA' $det $nodeRepo $nodeGlobal $nodeGet))
  }
  foreach ($t in @('npm', 'npx')) {
    $path = P (P $Facts $t) 'path'
    if ($path) { $results.Add((New-Result $t $t 'binario' 'OK' $path)) }
    else { $results.Add((New-Result $t $t 'binario' 'FALTA' "No hay $t junto a Node.js ni en el PATH" $nodeRepo $nodeGlobal $nodeGet)) }
  }

  # --- git ---
  $git = P $Facts 'git'
  $gitRepo = "PortableGit (Git for Windows portable) descomprimido en $v\git\ (cmd\git.exe)."
  $gitGlobal = "Instalador de Git for Windows (Git-2.x-64-bit.exe). Sin internet: copia el instalador; admite instalación desatendida con '/VERYSILENT /NORESTART'."
  $gitGet = "https://github.com/git-for-windows/git/releases/latest -> PortableGit-2.x-64-bit.7z.exe (repo) o Git-2.x-64-bit.exe (global). Con winget: 'winget download Git.Git'."
  if (P $git 'path') {
    $st = 'OK'; if ((P $git 'source') -eq 'vendor') { $st = 'OK (vendor)' }
    $results.Add((New-Result 'git' 'git' 'binario' $st "$(P $git 'version') en $(P $git 'path')"))
  } else {
    $results.Add((New-Result 'git' 'git' 'binario' 'FALTA' 'No hay git: lo necesitan el arranque de sesión, el motor del wiki y las puertas del ciclo (branch-change.mjs)' $gitRepo $gitGlobal $gitGet))
  }

  # --- Python 3 ---
  $pyRepo = "Python embeddable (zip) descomprimido en $v\python\."
  $pyGlobal = "Instalador de python.org 3.12 o superior para $cpu ('/quiet InstallAllUsers=1 PrependPath=1')."
  $pyGet = "https://www.python.org/downloads/windows/ -> python-3.12.x-embed-amd64.zip (repo) o python-3.12.x-amd64.exe (global). Con winget: 'winget download Python.Python.3.12'."
  $py = $null; $stores = @()
  foreach ($c in @(P (P $Facts 'python') 'candidates')) {
    if ($null -eq $c) { continue }
    if (P $c 'storeAlias') { $stores += (P $c 'path'); continue }
    $ver = Get-Version (P $c 'version')
    if ($ver -and $ver.Major -eq 3 -and $ver.Minor -ge 8) { $py = $c; $pyVer = $ver; break }
  }
  if ($py) {
    $st = 'OK'; if ((P $py 'source') -eq 'vendor') { $st = 'OK (vendor)' }
    $results.Add((New-Result 'python' 'Python 3' 'binario' $st "Python $pyVer en $(P $py 'path')"))
  } else {
    $det = 'No hay Python 3.8+: lo necesita el helper determinista del motor del wiki (lint, checkpoints...). Los workflows del wiki funcionan sin él.'
    if ($stores.Count -gt 0) { $det += ' El alias de la Microsoft Store no es un intérprete: ' + ($stores -join ', ') + '.' }
    $results.Add((New-Result 'python' 'Python 3' 'binario' 'FALTA' $det $pyRepo $pyGlobal $pyGet))
  }

  # --- Finales de línea del clon ---
  $le = P $Facts 'lineEndings'
  $reextract = "Con el árbol limpio, en la raíz del clon: 'git rm -r --cached -q .' y después 'git reset --hard'. .gitattributes ya fija LF."
  if (-not (P $le 'checked')) {
    $results.Add((New-Result 'line-endings' 'Finales de línea del clon' 'configuración' 'AVISO' 'No se han podido comprobar (hace falta git)' '' $noGlobal ''))
  } else {
    $crlf = @(P $le 'crlf' | Where-Object { $_ })
    if ($crlf.Count -eq 0) { $results.Add((New-Result 'line-endings' 'Finales de línea del clon' 'configuración' 'OK' 'Todos los archivos de texto versionados tienen LF')) }
    else {
      $show = ($crlf | Select-Object -First 5) -join ', '
      if ($crlf.Count -gt 5) { $show += ", ... (+$($crlf.Count - 5))" }
      $results.Add((New-Result 'line-endings' 'Finales de línea del clon' 'configuración' 'FALTA' "$($crlf.Count) archivos de texto versionados con CRLF: $show. Volver a extraerlos con LF: $reextract" `
            "Nada que incorporar: hay que volver a extraer el clon. $reextract" "$noGlobal $reextract" ''))
    }
  }

  # --- Instalación global (windows-global-distro, design D8) ---
  # Solo cuenta en un proyecto sin su propio schema (la variante adelgazada);
  # sin el hecho project, de un diagnóstico anterior, es la plantilla completa
  $proj = P $Facts 'project'
  $glob = P $Facts 'global'
  $slim = ($null -ne $proj) -and -not (P $proj 'ownSchema')
  $gData = P $glob 'data'; $gConfig = P $glob 'config'
  $gMissing = @()
  foreach ($it in @(P $glob 'items')) { if ($null -ne $it -and -not (P $it 'present')) { $gMissing += (P $it 'name') } }
  $gRepo = 'Pasar el proyecto a la plantilla completa: restaurar openspec\schemas\, .agents\, .opencode\ y .claude\ desde la plantilla de la misma versión.'
  $gGlobal = 'Ejecutar el instalador de la release, idd-<versión>.bat, de la misma versión que la variante adelgazada del proyecto. Instala en <data> y <config>, sustituye una instalación anterior y se puede volver a ejecutar.'
  $gGet = 'En la página de releases de la plantilla, idd-<versión>.bat. Al ejecutarse descarga idd-global-<versión>.zip de la misma release, así que necesita internet en ese momento.'
  if (-not $slim) {
    $results.Add((New-Result 'global-install' 'Instalación global' 'datos' 'OK' 'El proyecto lleva su propio schema, sus skills y sus plugins (plantilla completa): no necesita la instalación global'))
  } elseif (-not (P $glob 'version')) {
    $results.Add((New-Result 'global-install' 'Instalación global' 'datos' 'FALTA' "El proyecto es de la variante adelgazada y no hay instalación global en $gData\idd (falta $gData\idd\version)" $gRepo $gGlobal $gGet))
  } elseif ($gMissing.Count -gt 0) {
    $results.Add((New-Result 'global-install' "Instalación global ($(P $glob 'version'))" 'datos' 'FALTA' "La versión $(P $glob 'version') de la instalación global está incompleta en $gData y $gConfig\opencode: falta $($gMissing -join ', ')" $gRepo $gGlobal $gGet))
  } else {
    $results.Add((New-Result 'global-install' "Instalación global ($(P $glob 'version'))" 'datos' 'OK' "Versión $(P $glob 'version') en $gData y $gConfig\opencode"))
  }

  # --- Motor del wiki ---
  $eng = P $Facts 'engine'
  if ($slim -and -not (P $eng 'configured')) {
    # El de la instalación global: el proyecto adelgazado no tiene engine.json
    if ((P $glob 'version') -and ($gMissing -notcontains 'motor del wiki')) {
      $results.Add((New-Result 'wiki-engine' 'Motor del wiki' 'datos' 'OK' "De la instalación global, en $gData\idd\wiki-engine"))
    } else {
      $results.Add((New-Result 'wiki-engine' 'Motor del wiki' 'datos' 'FALTA' "El proyecto es de la variante adelgazada y la instalación global no tiene el motor en $gData\idd\wiki-engine" $gRepo $gGlobal $gGet))
    }
  } elseif (-not (P $eng 'configured')) {
    $results.Add((New-Result 'wiki-engine' 'Motor del wiki' 'datos' 'OK' 'No hay .agents\wiki\engine.json: el proyecto no usa el motor'))
  } else {
    $repo = P $eng 'repo'; $ref = P $eng 'ref'
    $want = "$ref $repo"
    $bundle = "llm-wiki-$ref.bundle"
    $name = "Motor del wiki ($ref)"
    $engRepo = "Un git bundle con el tag $ref en $v\$bundle, y en .agents\wiki\engine.json ""repo"": ""$($v.Replace('\','/'))/$bundle"" (el arranque admite cualquier URL de git, y 'git clone --branch $ref' funciona con un bundle)."
    $engGlobal = "Un clon compartido en la máquina (p. ej. C:\offline\llm-wiki.git, 'git clone --mirror') y, en engine.json, ""repo"": ""C:/offline/llm-wiki.git""."
    $engGet = "git clone --mirror https://github.com/nvk/llm-wiki.git llm-wiki.git; git -C llm-wiki.git bundle create ..\$bundle $ref"
    if ((P $eng 'installedRef') -eq $want) {
      $results.Add((New-Result 'wiki-engine' $name 'datos' 'OK' 'Instalado en .agents\wiki-engine\'))
    } elseif ((P $eng 'local') -and (P $eng 'localHasRef')) {
      $results.Add((New-Result 'wiki-engine' $name 'datos' 'OK (vendor)' "engine.json apunta a una fuente de git local con $ref ($repo)"))
    } elseif (P $eng 'local') {
      $results.Add((New-Result 'wiki-engine' $name 'datos' 'FALTA' "No está instalado y la fuente local de engine.json ($repo) no tiene $ref" $engRepo $engGlobal $engGet))
    } else {
      $results.Add((New-Result 'wiki-engine' $name 'datos' 'FALTA' "No está instalado (se espera '$want') y engine.json apunta a '$repo', que sin internet no se puede clonar" $engRepo $engGlobal $engGet))
    }
  }

  # --- Dependencias npm ---
  $offline = P (P $Facts 'npm') 'offline'
  $globalCache = P (P $Facts 'npm') 'globalCache'
  foreach ($proj in @(P $Facts 'npmProjects')) {
    if ($null -eq $proj) { continue }
    $label = P $proj 'label'; $rel = P $proj 'rel'
    $id = 'npm-root'; if ($label -ne 'raíz') { $id = "npm-$label" }
    $total = 0; $installed = 0; $inVendor = 0; $inGlobal = 0; $absent = @(); $plat = @()
    foreach ($p in @(P $proj 'packages')) {
      if ($null -eq $p) { continue }
      if (-not (Test-Platform (P $p 'os') $os) -or -not (Test-Platform (P $p 'cpu') $cpu)) { continue }
      $total++
      $nv = "$(P $p 'name')@$(P $p 'version')"
      if (@(P $p 'os' | Where-Object { $_ }).Count -gt 0 -or @(P $p 'cpu' | Where-Object { $_ }).Count -gt 0) { $plat += $nv }
      if (P $p 'installed') { $installed++ }
      elseif (P $p 'inVendorCache') { $inVendor++ }
      elseif (P $p 'inGlobalCache') { $inGlobal++ }
      else { $absent += $nv }
    }
    $platTxt = ''; if ($plat.Count -gt 0) { $platTxt = " Con binario propio de ${os}-${cpu}: " + ($plat -join ', ') + '.' }
    $repoTxt = "Una caché de npm ($v\npm-cache\_cacache) con los $total paquetes de $rel\package-lock.json para ${os}-${cpu}, e instalar con 'npm install --offline --cache <ruta absoluta de $v\npm-cache>'. O versionar $rel\node_modules\ instalado en Windows (no sirve el de Linux).$platTxt"
    $globalTxt = "Llenar la caché global de npm ($globalCache) con esos paquetes y configurar npm para trabajar sin red ('npm config set offline true'): el 'npm install' del arranque los toma de ahí sin cambiar el repo."
    $getTxt = "En una máquina Windows $cpu con internet: copiar $rel\package.json y package-lock.json a una carpeta vacía, ejecutar 'npm ci --cache <carpeta>\npm-cache --no-audit --no-fund' (en Windows, para que baje los binarios de win32) y copiar <carpeta>\npm-cache."
    $detail = "$total paquetes para ${os}-${cpu}: $installed instalados en $rel\node_modules, $inVendor en la caché del vendor, $inGlobal en la caché global."
    $name = "Dependencias npm ($label)"
    if ($absent.Count -gt 0) {
      $show = ($absent | Select-Object -First 8) -join ', '
      if ($absent.Count -gt 8) { $show += ", ... (+$($absent.Count - 8))" }
      $results.Add((New-Result $id $name 'datos' 'FALTA' "$detail Faltan $($absent.Count): $show" $repoTxt $globalTxt $getTxt))
    } elseif ($inGlobal -gt 0 -and $offline -ne 'true') {
      $results.Add((New-Result $id $name 'datos' 'AVISO' "$detail Los que no están instalados solo están en la caché global, y npm no está configurado para trabajar sin red (offline = $offline): el arranque intentaría usar la red." $repoTxt $globalTxt $getTxt))
    } elseif ($inVendor -gt 0) {
      $results.Add((New-Result $id $name 'datos' 'OK (vendor)' $detail))
    } else {
      $results.Add((New-Result $id $name 'datos' 'OK' $detail))
    }
  }

  # --- Agente: solo OpenCode 2 en Windows ---
  $agents = P $Facts 'agents'
  $oc = $null; $others = @()
  foreach ($a in @(P $agents 'opencode')) {
    if ($null -eq $a) { continue }
    $ver = Get-Version (P $a 'version')
    if ($ver -and $ver.Major -ge 2) { $oc = $a; $ocVer = $ver; break }
    $others += "OpenCode $(P $a 'version') ($(P $a 'path')): el proyecto solo admite OpenCode 2 o superior"
  }
  foreach ($a in @(P $agents 'claude')) {
    if ($null -eq $a) { continue }
    $others += "Claude Code $(P $a 'version') ($(P $a 'path')): no se soporta en Windows"
  }
  $note = 'En Windows solo se soporta OpenCode 2 o superior. Necesita llegar al proveedor del modelo; sin internet, solo con un modelo local (p. ej. un servidor compatible con OpenAI en la LAN).'
  if ($oc) { $results.Add((New-Result 'agent' 'Agente' 'binario' 'OK' "OpenCode $ocVer ($(P $oc 'path')). $note")) }
  else {
    $det = $note
    if ($others.Count -gt 0) { $det += ' Encontrado: ' + ($others -join '; ') + '.' }
    $results.Add((New-Result 'agent' 'Agente' 'binario' 'FALTA' $det "opencode.exe (binario único, versión 2.x) en $v\opencode\." `
          'Copiar opencode.exe (versión 2.x) a una carpeta del PATH.' "https://github.com/sst/opencode/releases -> opencode-windows-$cpu.zip"))
  }

  return $results
}

# =============================================================================
# Programa
# =============================================================================

if ($MyInvocation.InvocationName -eq '.') { return }

if (-not $ProjectDir) { $ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$ProjectDir = (Resolve-Path $ProjectDir).Path
if (-not $VendorDir) { $VendorDir = Join-Path $ProjectDir 'vendor\windows' }
$VendorRel = $VendorDir
if ($VendorDir.StartsWith($ProjectDir, [StringComparison]::OrdinalIgnoreCase)) {
  $VendorRel = $VendorDir.Substring($ProjectDir.Length).TrimStart('\', '/')
}

if ($FactsFile) {
  $facts = [IO.File]::ReadAllText((Resolve-Path $FactsFile).Path) | ConvertFrom-Json
} else {
  # Los hechos pasan por JSON, para que la evaluación vea siempre la misma forma que con -FactsFile
  $facts = (Get-ReadinessFacts $ProjectDir $VendorDir $VendorRel | ConvertTo-Json -Depth 8) | ConvertFrom-Json
}
$Results = Get-ReadinessReport $facts
$missing = @($Results | Where-Object { $_.Estado -eq 'FALTA' })

if ($Json) {
  [pscustomobject][ordered]@{
    proyecto   = $ProjectDir
    vendor     = $VendorDir
    plataforma = "$(P (P $facts 'platform') 'os')-$(P (P $facts 'platform') 'cpu')"
    resultados = @($Results)
  } | ConvertTo-Json -Depth 4
} else {
  Write-Host ''
  Write-Host "Diagnóstico de Windows: $ProjectDir ($(P (P $facts 'platform') 'os')-$(P (P $facts 'platform') 'cpu'))" -ForegroundColor Cyan
  Write-Host "Vendor del repo: $VendorDir"
  Write-Host ''
  $Results | Format-Table Estado, Tipo, Componente, Detalle -AutoSize -Wrap | Out-String -Width 220 | Write-Host
  $todo = @($Results | Where-Object { $_.Estado -eq 'FALTA' -or $_.Estado -eq 'AVISO' })
  if ($todo.Count -gt 0) {
    Write-Host 'Qué hacer con lo que falta o tiene avisos' -ForegroundColor Cyan
    foreach ($r in $todo) {
      $color = 'Yellow'; if ($r.Estado -eq 'FALTA') { $color = 'Red' }
      Write-Host ''
      Write-Host "[$($r.Estado)] $($r.Componente) ($($r.Tipo))" -ForegroundColor $color
      Write-Host "  Detalle : $($r.Detalle)"
      if ($r.Repo) { Write-Host "  Repo    : $($r.Repo)" }
      if ($r.Global) { Write-Host "  Global  : $($r.Global)" } else { Write-Host '  Global  : no hay alternativa global' }
      if ($r.Obtener) { Write-Host "  Obtener : $($r.Obtener)" }
    }
    Write-Host ''
  }
  if ($missing.Count -eq 0) { Write-Host 'No falta nada.' -ForegroundColor Green }
  else { Write-Host "Faltan $($missing.Count) componentes." -ForegroundColor Red }
}

if ($missing.Count -gt 0) { exit 1 }
exit 0
