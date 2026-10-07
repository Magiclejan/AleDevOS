# ALEDEVOS + CONTEXTOS â€” ROADMAP MAESTRO
**VersiÃ³n:** v0.1  
**Estado:** Base oficial de trabajo  
**Objetivo:** Sistema de desarrollo multiagente, local/portable, orientado a calidad, contexto eficiente, UX/UI consistente y reutilizaciÃ³n entre proyectos.

---

# 0. PRINCIPIO RECTOR

AleDevOS no debe depender de un modelo, proveedor o interfaz concreta.

Debe existir como un **sistema de desarrollo portable** formado por agentes, skills, workflows, gates, judges, repair loops, polÃ­ticas, gestiÃ³n de contexto, conocimiento persistente del proyecto, UX/UI governance, telemetrÃ­a y adapters para distintos runtimes.

OpenCode es el **primer runtime de validaciÃ³n**, no el producto final.

ContextOS serÃ¡ la capa encargada de decidir **quÃ© contexto necesita cada agente** y de mantener conocimiento persistente del proyecto.

> AleDevOS no debe resolver el problema de contexto ampliando indefinidamente la ventana. Debe resolverlo seleccionando mejor la informaciÃ³n.

---

# 1. PROYECTOS OBJETIVO

AleDevOS + ContextOS debe ser reusable en:

- INVERMIND
- MacroOS
- Resilient
- futuros proyectos

Cada proyecto aporta Ãºnicamente su conocimiento especÃ­fico. La lÃ³gica comÃºn vive en el Core.

```text
                ALEDEVOS CORE
                     â”‚
                 CONTEXTOS
                     â”‚
      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
      â†“              â†“              â†“
  INVERMIND       MACROOS       RESILIENT
      â”‚              â”‚              â”‚
 Project Map     Project Map    Project Map
 Domain Maps     Domain Maps    Domain Maps
 Decisions       Decisions      Decisions
 Design Context  Design Context Design Context
```

Runtimes futuros: OpenCode, Codex, Claude Code, Antigravity y otros.

---

# 2. ESTADO ACTUAL DEL RUNTIME LOCAL

## Hardware
- Windows 11 Pro
- Ryzen 9 9950X
- 64 GB RAM
- RTX 5060 8 GB VRAM

## Runtime
- OpenCode V2
- Qwen3.8-Flash-Next Coder
- Quant: IQ1_M

## ConfiguraciÃ³n actual objetivo
- Contexto: 65,536
- KV: INT8
- KV streaming: activo
- Expert cache: ~351 slots tras tuning
- Reasoning effort: HIGH
- Reasoning budget: 16,384
- `fit_max_tokens`: ON
- OpenCode output actual: 8,192
- Timeout OpenCode: 30 minutos
- Un solo request pesado simultÃ¡neo
- Subagentes secuenciales

## Rendimiento observado
- Benchmark corto tras tuning: ~33â€“40 tok/s
- Multiagente real: tool calls + subagents funcionando
- Researcher, Architect, Auditor, Builder, Verifier y Repairer ya observados en ejecuciÃ³n real

---

# 3. ALEDEVOS V1 â€” CIERRE OBLIGATORIO

## Pipeline base

```text
USER
 â†“
ORCHESTRATOR
 â†“
RESEARCHER
 â†“
ARCHITECT
 â†“
AUDITOR
 â†“
BUILDER / SCOPED EDITOR
 â†“
VERIFIER
 â†“
JUDGE REQUIREMENTS
 â†“
JUDGE REGRESSION
 â†“
JUDGE QUALITY
 â†“
FINAL PASS
```

Si algo falla:

```text
FAIL
 â†“
REPAIRER
 â†“
VERIFIER
 â†“
JUDGES
 â†“
PASS / FAILED / BLOCKED
```

## Regla de cierre
AleDevOS jamÃ¡s debe declarar â€œterminadoâ€ si no alcanza `PASS`, `FAILED` o `BLOCKED`.

### PASS exige
- verifier PASS
- build/typecheck/lint/tests PASS cuando correspondan
- judge-requirements >= 90
- judge-regression >= 90
- judge-quality >= 90
- sin BLOCKERS
- sin acceptance criteria UNVERIFIED

## Repair loop
- MÃ¡ximo automÃ¡tico inicial: 2 loops
- Si no se recupera: FAILED o BLOCKED
- Nunca maquillar un fallo como completado

## Validaciones obligatorias V1
1. Feature simple hasta PASS
2. Feature con fallo real â†’ Repairer â†’ PASS
3. Auditor bloqueando un plan defectuoso
4. Verifier bloqueando tests/typecheck
5. Judges rechazando un cambio insuficiente
6. Confirmar secuencialidad de subagentes
7. Confirmar permisos y bloqueos Git peligrosos

---

# 4. AGENTES V1

## Orchestrator
- clasifica tarea
- crea Task Contract
- selecciona workflow
- decide agentes
- impone secuencialidad
- controla gates
- cierra PASS/FAILED/BLOCKED

## Researcher
- repo mapping
- evidencia
- data flow
- contratos
- tests relevantes
- paths + lÃ­neas

## Architect
- smallest safe plan
- impacto
- acceptance criteria
- dependencias
- riesgos

## Auditor
- revisiÃ³n adversarial
- PLAN_APPROVED / PLAN_REJECTED

## Verifier
- build
- typecheck
- lint
- tests
- integration
- Playwright cuando aplique

## Builder / Editors
- Builder cross-cutting
- Editor Backend
- Editor Frontend
- Editor Database
- Editor Tests

## Repairer
Corrige sÃ³lo fallos concretos reportados.

## Judges
- Requirements
- Regression
- Quality

---

# 5. SKILLS CORE BASE

- task-contract
- repo-map
- implementation-plan
- safe-edit
- test-strategy
- requirements-check
- regression-analysis
- diff-review
- security-check
- repair-loop
- backend-change
- frontend-change
- database-change

Regla: las skills se cargan **on demand**.

---

# 6. V1.1 â€” OPTIMIZACIÃ“N DE CONTEXTO Y TOKENS

## 6.1 Context Budget por agente
Cada agente tendrÃ¡ target, warning y compact threshold.

Ejemplo inicial:

```yaml
orchestrator:
  target: 10000
  warning: 20000
  compact: 30000

researcher:
  target: 25000
  warning: 35000
  compact: 45000

architect:
  target: 20000
  warning: 30000

builder:
  target: 35000
  warning: 45000

judge:
  target: 15000
  warning: 25000
```

## 6.2 Structured Handoffs
Los agentes no pasan conversaciones completas.

```yaml
handoff:
  task_id: DEV-001
  domain: robustness
  affected_files: []
  current_behavior: []
  required_change: []
  dependencies: []
  relevant_tests: []
  risks: []
  evidence: []
  open_questions: []
```

## 6.3 Preventive Compaction

```text
0â€“60%   normal
60â€“70%  controlar exploraciÃ³n
70â€“80%  checkpoint/resumen
80â€“90%  compact obligatorio
>90%    no leer mÃ¡s sin justificaciÃ³n
```

## 6.4 Diff-first
DespuÃ©s de implementar:
- empezar por `git diff`
- pedir archivos completos sÃ³lo si son necesarios
- prohibir reread masivo del repo

## 6.5 Prompt de-duplication
Evitar repetir arquitectura, reglas, decisiones y outputs ya conocidos.

## 6.6 Context checkpoints
Cada fase genera checkpoint reusable.

## 6.7 InvestigaciÃ³n acotada
Researcher consulta mapas, identifica dominio, encuentra archivos candidatos, lee lo relevante y se detiene cuando tiene evidencia suficiente.

---

# 7. V1.2 â€” CONTEXTOS / PROJECT KNOWLEDGE

Por proyecto:

```text
.contextos/
â”œâ”€â”€ overview.md
â”œâ”€â”€ architecture.md
â”œâ”€â”€ repo-map.json
â”œâ”€â”€ dependency-map.json
â”œâ”€â”€ symbol-map.json
â”œâ”€â”€ api-map.md
â”œâ”€â”€ database-map.md
â”œâ”€â”€ testing-map.md
â”œâ”€â”€ conventions.md
â”œâ”€â”€ recent-changes.md
â””â”€â”€ domains/
```

## Repo Map
Mapa persistente del repositorio.

## Domain Maps
Cada dominio guarda:
- propÃ³sito
- archivos principales
- contratos
- dependencias
- tests
- decisiones
- riesgos conocidos
- componentes UI relacionados

## Dependency / Symbol Graph
Derivado preferentemente de AST, imports/exports, routes, schemas, migrations, tests y git history.

## Incremental Knowledge
Al completar una tarea:
- actualizar mapas
- registrar decisiones
- actualizar archivos canÃ³nicos
- registrar tests
- actualizar riesgos

## Research Cache
Reutilizar investigaciÃ³n vÃ¡lida si el mÃ³dulo no cambiÃ³.

## Freshness
Cada artefacto debe indicar fecha, fuentes y estado de vigencia.

---

# 8. V1.3 â€” TELEMETRÃA Y OBSERVABILIDAD

Cada run debe registrar:

- Run ID
- Proyecto
- Workflow
- Agentes
- LLM calls
- Input tokens
- Output tokens
- Context peak
- Avg tok/s
- Tool calls
- Archivos leÃ­dos
- Archivos modificados
- Repair loops
- Gates
- Judge scores
- Resultado
- DuraciÃ³n

Objetivo:

```text
ALEDEVOS RUN #128

Feature: Robustness Environment

Agents             8
LLM calls          27
Input tokens       91,422
Output tokens      18,310
Context peak       61%
Avg speed          34.7 tok/s

Repair loops       1
Gates              7/7 PASS

FINAL              PASS
```

AÃ±adir:
- benchmark automÃ¡tico
- comparativa antes/despuÃ©s de ContextOS
- resume/recovery desde checkpoint

---

# 9. UX/UI â€” CAPA DE PRIMER NIVEL

AleDevOS debe mantener:
- identidad
- consistencia
- UX
- motion
- accesibilidad
- reuse

```text
                  ALEDEVOS
                     â”‚
          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
          â”‚          â”‚          â”‚
       DEV CORE   ContextOS   UX/UI CORE
                                â”‚
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â†“               â†“               â†“
          Design System       Brand          Motion
```

---

# 10. UX/UI SKILL REGISTRY

## AnimaciÃ³n y movimiento
- animate
- animate-expo
- animation-vocabulary
- find-animation-opportunities
- improve-animations
- emil-design-eng
- apple-design

## DiseÃ±o visual y marca
- design
- design-system
- brand
- banner-design
- slides
- frontend-design
- ui-ux-pro-max
- ui-styling

## MÃ³vil / librerÃ­as
- mobile-native
- ask-sonner
- write-swift

Las skills son universales. El contexto visual es especÃ­fico de cada proyecto.

---

# 11. PROJECT DESIGN CONTEXT

```text
ContextOS/projects/<project>/design/
â”œâ”€â”€ product-personality.md
â”œâ”€â”€ brand.md
â”œâ”€â”€ ux-principles.md
â”œâ”€â”€ design-system.md
â”œâ”€â”€ tokens.json
â”œâ”€â”€ typography.md
â”œâ”€â”€ color-system.md
â”œâ”€â”€ spacing.md
â”œâ”€â”€ radii.md
â”œâ”€â”€ shadows.md
â”œâ”€â”€ layouts.md
â”œâ”€â”€ responsive.md
â”œâ”€â”€ motion-language.md
â”œâ”€â”€ interaction-patterns.md
â”œâ”€â”€ accessibility.md
â”œâ”€â”€ iconography.md
â”œâ”€â”€ component-registry.json
â””â”€â”€ decisions/
```

---

# 12. COMPONENT REGISTRY + REUSE BEFORE CREATE

Cada componente reusable tiene fuente canÃ³nica.

Regla:

```text
Â¿Existe?
 â”œâ”€ sÃ­ â†’ reutilizar
 â””â”€ no
    â†“
Â¿Puede extenderse?
 â”œâ”€ sÃ­ â†’ variant/composition
 â””â”€ no â†’ justificar componente nuevo
```

Prohibir duplicaciones locales accidentales.

Si algo reusable cambia, modificar canonical source.

---

# 13. NUEVOS AGENTES UX/UI

## Design System Guardian
Read-only:
- identifica componentes
- localiza tokens
- detecta duplicados
- decide reuse/extend/create
- verifica canonical source

## UX/UI Judge
Revisa:
- design consistency
- component reuse
- token compliance
- responsive
- accessibility
- empty/loading/error
- interaction states
- mobile
- motion

## Motion Director
Genera Motion Contract usando skills de motion cuando aplica.

---

# 14. MOTION LANGUAGE

Por proyecto.

Ejemplo:

```text
MICRO            100â€“160ms
STANDARD         160â€“240ms
LARGE            240â€“360ms

ENTER            spring / ease-out
EXIT             faster than enter
HOVER            subtle
REDUCED MOTION   mandatory
```

---

# 15. UI DECISION RECORDS

Registrar decisiones reutilizables.

Ejemplo:

```text
UI-ADR-014

Advanced Filters
â†’ Right Drawer
â†’ width 420px
â†’ canonical FilterDrawer
â†’ never modal
```

---

# 16. MODOS DE PROYECTO

## GREENFIELD
Proyecto desde cero â†’ `DESIGN_GENESIS`

## BROWNFIELD
Proyecto existente â†’ `DESIGN_SYSTEM_DISCOVERY`

## HYBRID
Proyecto inconsistente â†’ `DESIGN_AUDIT_AND_CONSOLIDATE`

---

# 17. GREENFIELD â€” DESIGN_GENESIS

```text
PRODUCT IDEA
 â†“
PRODUCT CONTRACT
 â†“
DESIGN GENESIS
 â”œâ”€â”€ brand
 â”œâ”€â”€ UX principles
 â”œâ”€â”€ visual direction
 â”œâ”€â”€ tokens
 â”œâ”€â”€ typography
 â”œâ”€â”€ motion
 â”œâ”€â”€ accessibility
 â””â”€â”€ responsive
 â†“
FOUNDATION COMPONENTS
 â†“
REFERENCE SCREENS
 â†“
DESIGN SYSTEM FREEZE v0.1
 â†“
FEATURE DEVELOPMENT
```

Reference screens:
1. Dashboard / overview
2. Data-dense screen
3. Form / create-edit
4. Detail view
5. Empty/loading/error state

Freeze = fuente de verdad actual, no inmovilidad eterna.

---

# 18. BROWNFIELD â€” DESIGN SYSTEM DISCOVERY

Inventariar:
- Buttons
- Modals
- Cards
- Drawers
- Toasts
- Tables
- Inputs
- Tokens
- Hardcoded colors
- Spacing variants
- Motion variants

Detectar duplicados, forks y divergencias. Consolidar en componentes canÃ³nicos.

---

# 19. VISUAL REGRESSION

Base:
- Playwright screenshots
- pixel diff
- layout regression

Futuro:
- Visual Judge local para jerarquÃ­a, spacing, overflow, alignment, responsive y consistencia.

---

# 20. ADAPTIVE REASONING

PolÃ­tica inicial:

```text
Orchestrator       HIGH
Architect          HIGH
Auditor            HIGH
Researcher         HIGH + Context Budget
Builder            HIGH
Judge Requirements HIGH
Judge Regression   HIGH
Judge Quality      HIGH

Verifier           LOW/NONE
micro edits        MEDIUM
```

Futuro: routing segÃºn riesgo.

---

# 21. CONTEXTOS COMO SISTEMA INDEPENDIENTE

```text
ContextOS/
â”œâ”€â”€ engine/
â”œâ”€â”€ schemas/
â”œâ”€â”€ retrieval/
â”œâ”€â”€ budgets/
â”œâ”€â”€ handoffs/
â”œâ”€â”€ compaction/
â”œâ”€â”€ knowledge/
â”œâ”€â”€ telemetry/
â””â”€â”€ projects/
```

AgnÃ³stico a OpenCode, Qwen, Claude, Codex, Antigravity y futuros runtimes.

---

# 22. ALEDEVOS CORE PORTABLE

```text
AleDevOS-Core/
â”œâ”€â”€ agents/
â”œâ”€â”€ skills/
â”œâ”€â”€ workflows/
â”œâ”€â”€ gates/
â”œâ”€â”€ judges/
â”œâ”€â”€ policies/
â”œâ”€â”€ schemas/
â””â”€â”€ context-contracts/
```

Adapters:

```text
adapters/
â”œâ”€â”€ opencode/
â”œâ”€â”€ codex/
â”œâ”€â”€ claude-code/
â”œâ”€â”€ antigravity/
â””â”€â”€ generic/
```

---

# 23. SKILL PACK PORTABLE

Skills objetivo:
- repo-map
- task-contract
- implementation-plan
- safe-edit
- test-strategy
- requirements-check
- regression-analysis
- security-check
- diff-review
- repair-loop
- context-budget
- structured-handoff
- component-registry
- reuse-before-create
- ux-ui-check
- motion-contract

Modos:
- Full Multi-Agent
- Single Agent Mode

---

# 24. SEGUNDO MODELO PARA JUDGES

Actualmente todos usan Qwen en sesiones separadas.

Futuro:
- segundo modelo local diferente
- judges realmente independientes
- posible ensemble

---

# 25. MODEL ROUTER

Routing segÃºn:
- tarea
- riesgo
- coste
- contexto
- latencia
- disponibilidad

---

# 26. WORKTREES / ISOLATED WORKERS

- git worktrees
- tareas aisladas
- workers independientes
- merge controlado
- conflict detection

---

# 27. SAFE CONCURRENCY

Ahora: un request pesado secuencial.

Futuro:
- concurrencia sÃ³lo si es segura
- modelos distintos
- mÃ¡quinas distintas
- worktrees aislados
- dispatcher/queue

---

# 28. SEGURIDAD Y REGLAS DURAS

Mantener:
- no git push automÃ¡tico
- no git reset --hard
- no git clean
- no publish
- no external directory sin permiso
- no operaciones destructivas

AÃ±adir:
- migration safety
- DB destructive change guard
- secret detection
- dependency risk
- no weakening tests
- no borrar tests para pasar gates
- no silent mocks
- no fake production data

---

# 29. PROJECT ONBOARDING

Cada proyecto se clasifica GREENFIELD/BROWNFIELD/HYBRID.

Onboarding:
1. Project overview
2. Stack detection
3. Repo map
4. Dependency map
5. Domain map
6. Testing map
7. Conventions
8. Design mode
9. Design system context
10. Risk profile
11. Gates disponibles
12. Adapter/runtime
13. Telemetry baseline

---

# 30. FOCO POR PROYECTO

## INVERMIND
- ContextOS fuerte
- Domain Maps
- reducciÃ³n tokens
- Component Registry
- Design System Guardian
- UI Decision Records

## MacroOS
- introducir ContextOS antes de que sea enorme
- reducir consumo con Antigravity
- probar portabilidad fuera de OpenCode

## Resilient
- facilitar reactivaciÃ³n
- preservar â€œdÃ³nde nos quedamosâ€
- knowledge bootstrap
- evitar rediscovery

---

# 31. ROADMAP PRIORIZADO

## AHORA â€” V1
1. Completar feature sandbox hasta PASS
2. Confirmar Repairer real
3. Confirmar re-verification
4. Confirmar 3 judges
5. Confirmar cierre PASS/FAILED/BLOCKED
6. Confirmar seguridad/permisos
7. Congelar V1 estable â€” VALIDATION HARNESS READY in v1.27; TARGET EVIDENCE PENDING

## SIGUIENTE â€” V1.1
8. Context Budgets
9. Structured Handoffs
10. Preventive Compaction
11. Diff-first
12. Prompt de-duplication
13. Context checkpoints

## EN PARALELO UX/UI BASE
14. Skill Registry UX/UI
15. Project Design Context schema
16. Component Registry
17. Reuse-Before-Create gate
18. Design System Guardian
19. UX/UI Judge
20. Motion Director
21. Motion Language
22. UI Decision Records

## V1.2 â€” CONTEXTOS
23. Repo Map persistente
24. Domain Maps
25. Dependency Map
26. Symbol Map
27. Incremental Knowledge
28. Research Cache
29. Freshness/invalidation

## V1.3 â€” OBSERVABILIDAD
30. Token telemetry
31. Context telemetry
32. tok/s telemetry
33. Gate telemetry
34. Repair metrics
35. Automatic benchmark
36. Resume/recovery

## V2 â€” PORTABILIDAD
37. Extraer ContextOS â€” âœ… COMPLETE / FROZEN
38. Extraer AleDevOS Core â€” âœ… COMPLETE / FROZEN
39. Adapter ABI + Capability Negotiation â€” âœ… COMPLETE / FROZEN (v1.28)
40. OpenCode Adapter Certification â€” âœ… COMPLETE / FROZEN (v1.29)
41. Codex Adapter â€” âœ… COMPLETE / FROZEN (v1.30)
42. Claude Code Adapter â€” âœ… COMPLETE / FROZEN (v1.31)
43. Google Antigravity Adapter + Gemini compatibility â€” âœ… COMPLETE / FROZEN (v1.32)
44. Cross-adapter Conformance + Portable Skill Pack â€” âœ… COMPLETE / FROZEN (v1.33)

## V2.1 â€” MULTI-MODEL
45. Segundo modelo Judge â€” âœ… COMPLETE / FROZEN (v1.34)
46. Model Router â€” âœ… COMPLETE / FROZEN (v1.35)
47. Judge diversity â€” âœ… COMPLETE / FROZEN (v1.36)
48. Model fallback â€” âœ… COMPLETE / FROZEN (v1.37)

## V3 â€” EJECUCIÃ“N AVANZADA
49. Worktrees â€” âœ… COMPLETE / FROZEN (v1.38)
50. Isolated workers â€” âœ… COMPLETE / FROZEN (v1.39)
51. Safe concurrency â€” âœ… COMPLETE / FROZEN (v1.40)
52. Dispatcher/queue â€” âœ… COMPLETE / FROZEN (v1.41)
53. Multi-machine support â€” âœ… COMPLETE / FROZEN (v1.42)

## MASTER VALIDATION / V1 RELEASE
54. Current-Stack Harness + Release Evidence Matrix â€” âœ… COMPLETE / FROZEN (v1.43)
55. Adapter Runtime + Target Security â€” âœ… COMPLETE / FROZEN (v1.44)
56. Multi-Model Target Binding â€” â† NEXT
57. Visual Runtime + Bounded Repair â€” â³
58. Advanced Execution Target Validation â€” â³
59. End-to-End Real Project + Final V1 Gate â€” â³

## UX/UI FUTURO
60. Design System Discovery
61. Design Audit & Consolidate
62. Visual Regression
63. Visual Judge â€” IMPLEMENTED/FROZEN in AleDevOS Local v1.26 Visual QA Phase 5
64. Reference-screen validation
65. Mobile UX checks
66. Accessibility automation

---

# 32. CRITERIOS DE â€œLISTO PARA PROYECTO REALâ€

1. sandbox simple PASS
2. sandbox repair PASS
3. read-only repo real
4. change pequeÃ±o real
5. feature frontend/backend real
6. test regression real
7. context budget funcionando
8. structured handoff funcionando
9. telemetry funcionando
10. UX/UI reuse gate funcionando

---

# 33. PRINCIPIOS QUE NO DEBEN ROMPERSE

1. Quality before speed
2. Context relevance before context size
3. Reuse before create
4. Canonical source before local fork
5. Deterministic evidence before LLM opinion
6. No PASS without proof
7. No destructive actions by default
8. Sequential heavy inference on current hardware
9. Project knowledge accumulates
10. Runtime/model agnostic
11. UX/UI is part of product quality
12. Every feature must be auditable
13. Every handoff must be compact
14. Every reusable decision must persist
15. Every large project should become cheaper to work on over time

---

# 34. NORTH STAR

```text
USER
 â†“
AleDevOS
 â†“
ContextOS
 â†“
Task Contract
 â†“
Relevant Context
 â†“
Specialized Agents
 â†“
Implementation
 â†“
Deterministic Gates
 â†“
Judges
 â†“
Repair
 â†“
UX/UI Governance
 â†“
PASS
 â†“
Knowledge Update
```

Mismo sistema para INVERMIND, MacroOS, Resilient y proyectos futuros.

---

# 35. DECISIÃ“N DE ARQUITECTURA FINAL

**OpenCode es el laboratorio y primer adapter.**

**AleDevOS es el sistema de trabajo.**

**ContextOS es la memoria/context engine.**

**Project Context define cada aplicaciÃ³n.**

**UX/UI Core protege coherencia visual y experiencia.**

**Skills aportan capacidades especializadas.**

**Adapters permiten mover el sistema entre agentes/runtimes.**

## 2026-10-05 â€” UX/UI System 1.0 milestone
UX/UI phases 1-6 and static rendered Visual QA phases 1-5 are COMPLETE/FROZEN through project mode/design context, component reuse, design genesis/discovery, Guardian/Judge, motion governance, accessibility/responsive/state contracts, immutable UI ADRs, browser evidence, regression, runtime checks, native-image visual judgment and bounded repair. Final target-runtime smoke/validation remains before AleDevOS V1 can be considered complete.


## 2026-10-06 â€” V1 release-candidate milestone
AleDevOS Local v1.27 adds the final target-runtime validation and sealed release gate for prioritized roadmap item 7. The deterministic RC is 570/570 PASS, with 51/51 MJS syntax and 117/117 JSON parse checks. V1 remains intentionally UNFROZEN until real target evidence proves Playwright/Chromium adapter execution, native-image Visual Judge observation, repair-success and two-repair-exhaustion paths, full controlled real-project PASS, security and deterministic regression. Only `V1_RELEASE_READY` closes item 7.


## 2026-10-06 â€” Portability P3 / Codex Adapter milestone
AleDevOS Local v1.30 closes Codex as the second implemented Adapter ABI 2.0 runtime. OpenCode P2 remains frozen. Codex uses its own project configuration, custom role layers, repository Skills, permission profiles and certification rather than imitating OpenCode syntax. The earlier v1.27 release gate remains deferred until Portability, Multi-Model and Advanced Execution are complete.

## 2026-10-06 â€” Portability P4 / Claude Code Adapter milestone
AleDevOS Local v1.31 closes Claude Code as the third implemented Adapter ABI 2.0 runtime. The adapter uses Claude-native project settings, custom subagents, repository Skills and deterministic PreToolUse shell governance rather than imitating OpenCode or Codex. Package certification is deliberately separated from target Claude CLI/model/browser/platform readiness. Next: Google Antigravity adapter family (Gemini compatibility) and then cross-adapter conformance.


## 2026-10-06 â€” Portability P5 / Google Antigravity milestone
AleDevOS Local v1.32 closes the canonical Google adapter family. Antigravity is the implementation; `gemini` remains an explicit compatibility/migration alias and is ABI-locked to the canonical capability set. The adapter uses native `.agents/agents`, `.agents/skills` and workspace hooks with deterministic AleDevOS guarding. Package certification is intentionally separate from target Antigravity CLI/auth/platform/hook/browser readiness. Next: Cross-adapter Conformance + Portable Skill Pack.


## 2026-10-06 â€” Portability P6 / Cross-adapter Conformance milestone
AleDevOS Local v1.33 closes package-level Portability. OpenCode, Codex, Claude Code and Google Antigravity now pass one normalized conformance matrix, one semantic Portable Skill Pack and one cross-adapter sourceâ†’installed parity gate. Gemini remains an ABI-locked alias to Antigravity. P6 also removes the remaining runtime-specific OpenCode path names from Core policy. Historical regression is 818/818 PASS; P6 adds 69/69 for 887/887 cumulative. Next: V2.1 Multi-Model item 45 â€” Segundo modelo Judge.


### v1.34 Multi-Model P1 closure
AleDevOS Local v1.34 introduces an adapter-independent model registry with two explicit Judge slots, target model binding, sealed model provenance, immutable input/rubric pairing, advisory AGREE/DISAGREE/INCOMPLETE comparison and fail-closed readiness. It deliberately does not hard-code the secondary target model and does not implement routing, diversity enforcement or fallback. Historical regression remains frozen; P1 adds 54 deterministic tests. Next: V2.1 item 46 â€” Model Router.


### v1.35 Multi-Model P2 closure
AleDevOS Local v1.35 adds a deterministic adapter-independent Model Router over the explicit P1 Judge bindings. Routing filters fail closed on bound identity, runtime readiness, required modalities, context-window fit plus safety reserve and cost ceiling, then selects deterministically by cost/context policy. Route evidence is SHA-256 sealed and independently recomputed during verification. Provider diversity remains deferred to P3 and automatic fallback to P4. P1 remains frozen because P2 is implemented in a separate router runtime.


### v1.37 Multi-Model P4 closure
AleDevOS Local v1.37 closes V2.1 Multi-Model with explicit bounded fallback. P4 uses only predeclared fallback plans, allows at most two hops, preserves P2 runtime/modality/context/cost constraints and P3 diversity, prohibits Judge-result shopping and hidden provider/model discovery, seals fallback provenance, and requires fresh P2/P3 evidence after any replacement.


### v1.38 Advanced Execution P1 closure
AleDevOS Local v1.38 opens V3 Advanced Execution with deterministic Git worktree isolation. P1 requires a clean attached primary checkout, pins requests to exact base commits, derives task branch/path internally, preserves the primary checkout, seals creation/cleanup receipts, blocks dirty cleanup and deliberately leaves worker execution/concurrency/queue/multi-machine behavior to later phases. Next: item 50 â€” Isolated workers.


### v1.39 Advanced Execution P2 closure
AleDevOS Local v1.39 binds one isolated worker lifecycle to one P1 worktree and task contract. P2 uses a real supervisor process with PID/heartbeat/CWD evidence, deterministic worker identity, exclusive worktree ownership, role/task write scopes, project protected-path enforcement, serialized lifecycle mutations, bounded recovery, Git-derived handoff and durable primary-state evidence snapshots. Handoff remains verifiable after safe P1 worktree cleanup. P2 deliberately keeps concurrent workers disabled. Next: item 51 â€” Safe concurrency.


### v1.40 Advanced Execution P3 closure
AleDevOS Local v1.40 adds repository-global safe concurrency over isolated P2 workers. P3 enforces write/write and write/read conflict blocking, global leases, a repository-wide parallelism cap and independent recovery. P4 later exposed a stale dead-lock edge case; v1.41 refreshes the P3 certificate after adding dead-owner lock recovery without changing admission semantics.

### v1.41 Advanced Execution P4 closure
AleDevOS Local v1.41 adds a durable local Dispatcher/Queue above P3. Verified P3 plans are snapshotted into repo-owned queue state, scheduled by deterministic priority/FIFO epoch aging, and dispatched only through P3. Queue/item pause/resume, cancel, explicit completion, drain, bounded retry accounting, work-conserving handling of blocked items and stale dispatcher-lock recovery are included. Multi-machine/network scheduling remains disabled. Next: item 53 â€” Multi-machine support.

## v1.42 â€” Advanced Execution P5 closure

AleDevOS Local v1.42 closes Advanced Execution P5 at package level. P1-P5 are COMPLETE/FROZEN. P5 adds Ed25519 machine identities, explicit approval/trust, signed anti-replay heartbeats, capability-aware remote task assignment, bounded leases, fencing tokens, signed bundle transfer, stale-owner reassignment and single-authoritative-result enforcement. Real network transport and real host-to-host adapter/model execution are intentionally deferred to Master Validation. With Portability, Multi-Model and Advanced Execution complete, the retained V1 target-runtime release gate becomes the next roadmap stage.
