# AleDevOS CLI

Instala la CLI una sola vez desde el checkout canónico:

    .\repo-tools\INSTALL_CLI.ps1

## Primera incorporación a un proyecto

El mismo comando sirve para una carpeta vacía y para un proyecto existente:

    aledevos init

AleDevOS detecta si el directorio está vacío, si ya contiene un proyecto o si ya tenía AleDevOS.

La selección de runtimes es múltiple:

    Adapters de IA para este proyecto:
      1. Codex
      2. Claude Code
      3. OpenCode
      4. Antigravity
      A. Todos

    Ejemplos: 1 | 1,3 | A

También puede indicarse sin interacción:

    aledevos init -Adapter codex,opencode
    aledevos init -Adapter all

Los adapters se acumulan. Instalar OpenCode en un proyecto que ya tiene Codex no elimina Codex.

Volver a ejecutar `aledevos init` permite añadir adapters que aún no estén instalados.

## Proyecto existente

`aledevos init` no significa "crear proyecto". Significa "incorporar AleDevOS a este proyecto".

Por tanto, para un repositorio ya existente:

    cd C:\ruta\ProyectoExistente
    aledevos init

AleDevOS preserva el código del producto y proyecta su control plane/configuración alrededor del proyecto.

## Actualización

Sin argumentos, actualiza todos los adapters registrados en `.aledevos/project.json`:

    aledevos update

Puede limitarse a adapters concretos:

    aledevos update -Adapter codex,opencode

## Fuente canónica

    aledevos where

El checkout canónico de AleDevOS es único; cada proyecto puede tener cualquier subconjunto de adapters instalados.
