import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('product surface exposes one Windows launcher',()=>{
  const bats=fs.readdirSync(root).filter(x=>x.toLowerCase().endsWith('.bat')).sort();
  assert.deepEqual(bats,['START_ALEDEVOS.bat']);
  const launcher=read('START_ALEDEVOS.bat');
  assert.match(launcher,/70-aledevos-app\.ps1/);
});

test('installer supports new empty, existing non-Git and existing Git projects without implicit git init',()=>{
  const s=read('scripts/05-install-into-project.ps1');
  assert.match(s,/New-Item -ItemType Directory -Force -Path \$targetInput/);
  assert.match(s,/NEW_EMPTY/);
  assert.match(s,/EXISTING_GIT/);
  assert.match(s,/EXISTING_NO_GIT/);
  assert.match(s,/git_repository/);
  assert.doesNotMatch(s,/\bgit\s+init\b/i);
});

test('CLI start is install-on-first-use and launches exactly one selected adapter',()=>{
  const s=read('cli/aledevos.ps1');
  assert.match(s,/ValidateSet\('start','init','update','where','help'\)/);
  assert.match(s,/'start'\s*\{/);
  assert.match(s,/AleDevOS no estaba instalado/);
  assert.match(s,/Invoke-Install/);
  assert.match(s,/Invoke-Adapter/);
  assert.match(s,/START_REQUIRES_ONE_ADAPTER/);
});

test('APP has one primary start action and can create a missing project folder',()=>{
  const s=read('scripts/70-aledevos-app.ps1');
  assert.match(s,/function Start-AleDevOSProject/);
  assert.match(s,/function Resolve-OrCreateProjectPath/);
  assert.match(s,/INICIAR ALEDEVOS/);
  assert.match(s,/Instala en primer uso y abre el runtime elegido/);
  assert.match(s,/New-Item -ItemType Directory -Force -Path \$full/);
  assert.match(s,/function Show-AdvancedMenu/);
});

test('README documents installation and all three project states',()=>{
  const s=read('README.md');
  assert.match(s,/## Install AleDevOS/);
  assert.match(s,/START_ALEDEVOS\.bat/);
  assert.match(s,/aledevos start/);
  assert.match(s,/New path \/ empty project/);
  assert.match(s,/Existing project without Git/);
  assert.match(s,/Existing Git repository/);
  assert.match(s,/never initializes Git behind the user's back/);
});

test('obsolete root onboarding artifacts remain removed',()=>{
  for(const p of [
    'EMPEZAR_AQUI.bat',
    '1_INVENTARIO_MASTER.bat',
    '2_COMPROBAR_RUNTIMES.bat',
    '3_INSTALAR_EN_PROYECTO.bat',
    '4_VALIDACION_FINAL.bat',
    'HOTFIX_WINDOWS_PATHS.txt',
    'LEEME_HOTFIX11.txt',
    'LEEME_HOTFIX12.txt',
    'LEEME_HOTFIX13.txt',
    'LEEME_PRIMERO.txt',
    '.gitignore.append.txt'
  ]) assert.equal(fs.existsSync(path.join(root,p)),false,p);
});
