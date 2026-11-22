---
title: "Collection: archivado de name-change-in-merge-title (idd@4b8d2b3)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, name-change-in-merge-title]
summary: "Manifest for a collection ingest of the intent-driven template repository: 12 files touched by name-change-in-merge-title (the check merge gate titles the merge with a permanent branch as 'Merge <change> into <destino>', naming every change of the branch in alphabetical order or the branch when it has none; in an ephemeral container it asks for that title on the PR and its merge commit; branch-change.mjs, its core tests and steps, the git-discipline skill, the README, the synced openspec-change-lifecycle spec and the archived change) pinned by path and blob SHA at commit 4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6. No file bodies are copied."
collection: "idd"
adapter: git
revision: "4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6"
canonical_url: "https://github.com/hiebra/idd/tree/4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6"
license: "unknown"
manifest_only: true
---

# Collection: archivado de name-change-in-merge-title (idd@4b8d2b3)

Fija, en el commit del archivado, lo que tocó el change `name-change-in-merge-title`: la puerta `check merge` hacia una rama permanente titula la fusión `Merge <change> into <destino>`, con el change de la rama (en curso o archivado), todos sus changes en orden alfabético separados por \", \" si tiene varios, o el nombre de la rama si no tiene ninguno; un directorio de `openspec/changes/` que no es kebab-case no cuenta. Fuera de un contenedor efímero, ese título es el mensaje del `git commit-tree`; en un contenedor efímero, la puerta pide ese título para el PR (también si ya estaba abierto) y lo recomienda para su commit de fusión, y sin change no da título. Incluye `branch-change.mjs`, sus tests y pasos, la skill de disciplina de git, el README, la spec `openspec-change-lifecycle` sincronizada y el change archivado. Cita como `idd@4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de git-discipline-standard-with-exception](2026-11-22-idd-e9fced1-git-discipline-standard-with-exception.md).

| Path | Blob SHA |
|---|---|
| `.agents/openspec/branch-change.mjs` | `5e6ff7313d3a8837a8494a0aba03d3142bb7b24a` |
| `.agents/skills/openspec-git-discipline/SKILL.md` | `f829993fe248924e6dd20895471e82638879e2e5` |
| `README.md` | `d6b56981adc88e631533114d9d8bd340158b8e8b` |
| `acceptance-tests/core-tests/branch-change.test.js` | `475347573435b1508b6bd02b4458cdab759f7cdb` |
| `acceptance-tests/step-definitions/change-lifecycle.steps.js` | `c2a996a2535313c252b47df8bfcdb4616124fae5` |
| `openspec/changes/archive/2026-11-22-name-change-in-merge-title/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-name-change-in-merge-title/adr.md` | `127dfae2fbde0a0532bde1e9c9bcc74a0f26bbae` |
| `openspec/changes/archive/2026-11-22-name-change-in-merge-title/design.md` | `320f98198e151afffafab97e98da6568b218b12c` |
| `openspec/changes/archive/2026-11-22-name-change-in-merge-title/proposal.md` | `b40ce6d72d945e066629b7ad60cef58b081efc45` |
| `openspec/changes/archive/2026-11-22-name-change-in-merge-title/specs/openspec-change-lifecycle/spec.md` | `28dcab96dea3d4c917fd61d503c62bce76450478` |
| `openspec/changes/archive/2026-11-22-name-change-in-merge-title/tasks.md` | `131f748e2824b5fa15b5c36c0171563abd1ae6b1` |
| `openspec/specs/openspec-change-lifecycle/spec.md` | `2f759846a133f69bbc6633404790368aea96bdcc` |
