---
title: "openspec-git-discipline behaves poorly when developing with a protected main branch"
source: "https://github.com/intent-driven-dev/intent-driven-template/issues/11"
type: articles
ingested: 2026-11-21
tags: [openspec, openspec-git-discipline, git, github-issue, intent-driven-template]
summary: "Issue abierta en intent-driven-dev/intent-driven-template: con un main protegido, las puertas de openspec-git-discipline (propuesta fusionada en main antes de apply, archive desde main) obligan a 13 pasos y tres PR por change, y no encajan con gitflow ni con el desarrollo por PR. Describe el problema sin proponer solución."
canonical_url: "https://github.com/intent-driven-dev/intent-driven-template/issues/11"
upstream_id: "intent-driven-dev/intent-driven-template#11"
upstream_type: github-issue
authors: [dclements]
created_upstream: 2026-11-07T00:00:30Z
updated_upstream: 2026-11-07T00:00:30Z
state: open
comments: 0
content_format: markdown
fetched: 2026-11-21
extraction_tool: "gh api search/issues (la API de issues y la página HTML devolvieron 403 desde el proxy de la sesión)"
---

# openspec-git-discipline behaves poorly when developing with a protected main branch

> Issue [intent-driven-dev/intent-driven-template#11](https://github.com/intent-driven-dev/intent-driven-template/issues/11), abierta por `dclements` el 2026-11-07. Estado al 2026-11-21: abierta, sin comentarios, sin etiquetas y sin ramas ni PR enlazadas; no se ha editado desde que se abrió (`updated_at` = `created_at`).
>
> Es una fuente viva: puede recibir comentarios o cerrarse. Lo que sigue es su cuerpo tal como estaba el 2026-11-21, copiado literalmente, en su idioma original.

## Cuerpo

If you are working on a project with a protected `main` branch you will basically never be committing directly to `main`, but the skill expects things to not only pass through main but—for the purposes of `archive`—**you** to be on `main` when it is run. This flow also does not play nicely with other git development methodologies (e.g., gitflow, or a lot of PR-driven development), despite that otherwise the intent driven development patterns should work fine otherwise. 

To break down the problem, at the moment in order to work with the gates in this skill you need to:

1. Create a proposal.
2. Check in that proposal in a branch.
3. Create a PR for that proposal
4. Get that proposal merged into the main branch specifically
5. Sync the main branch.
6. Create another branch to do the work. 
7. Create a PR for it.
8. Get that PR merged into the main branch. 
9. Sync the main branch.
10. In the main branch specifically archive it.
11. Move the changes to a new branch. 
12. Create a PR for that new branch. 
13. Get that new PR merged into main.
