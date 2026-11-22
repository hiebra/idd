# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. One durable decision is new: in OpenCode, an optional instruction can have its own plugin as its adapter. It refines ADR-0010 without superseding it.

## In-Force ADRs Reviewed

- ADR-0002: agent-neutral session bootstrap.
- ADR-0003: single source for schema skills.
- ADR-0004: wiki-first project knowledge.
- ADR-0005: wiki engine through the session bootstrap.
- ADR-0006: agent asymmetry policy. Not applicable: the rule exists in both agents.
- ADR-0009: wiki read and write operations.
- ADR-0010: agent instructions through the session bootstrap. Refined by ADR-0018.
- ADR-0011: OpenCode plugins release what they register.
- ADR-0012: spec lint with gplint.
- ADR-0013: the model creates change branches and the plugin stages.
- ADR-0014: autopilot verifies the product and closes reviews with git. It supersedes ADR-0008, whose criterion of keeping optional automation out of `session-bootstrap` is reused here.
- ADR-0015: two forms of git discipline and ephemeral commits.
- ADR-0016 and ADR-0017 exist only on other remote branches. They were read for numbering and do not constrain this change.

## New Durable ADRs Created

- [ADR-0018](../../../adr/0018-opencode-optional-instructions-own-plugin.md): in OpenCode, an optional instruction of the project has its own plugin as its adapter.
