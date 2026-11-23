# ADR Review Manifest

- Status: completed
- Review date: 2026-11-23

## Review Summary

ADR review completed for this change.

The change introduces no major durable architectural decisions, and no new repository-level ADR files were created. The design's decisions are configuration and tests within commitments already in force:

- an apply guidance entry in `openspec/config.yaml` (D1, D2);
- its read-only mirror of the tracking file (D3);
- a per-user opt-in documented in the README (D4);
- the generalised acceptance helpers (D5).

## In-Force ADRs Reviewed

- `adr/0021-project-wiki-disabled-by-default-with-project-switch.md`, with what it keeps of ADR-0010, that every instruction reaches the agent through the session bootstrap: not contradicted. The entry configures the OpenSpec workflow, like the archive guidance and the apply block already in the file; it is not a session instruction.
- `adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md`: in force and unchanged. Its exception does not apply, because the entry depends on no user preference and no plugin writes it. The plugin's block stays after the entry in both modes.
- `adr/0022-autopilot-session-owns-its-branch-and-worktrees.md` and `adr/0020-git-discipline-standard-rule-with-protected-main-exception.md`: in force, with no direct bearing. The entry adds no commits, branches or files.
- `adr/0011-opencode-plugins-release-what-they-register.md`, `adr/0018-opencode-optional-instructions-own-plugin.md` and `adr/0019-autopilot-plan-agent-explores-and-warns.md`: in force, with no direct bearing. No plugin changes.
- In force and unrelated: `adr/0002`, `adr/0003`, `adr/0009`, `adr/0012` and `adr/0017`.
- Superseded, historical context only:
  - `adr/0001`, by ADR-0002;
  - `adr/0004`, `adr/0005` and `adr/0010`, by ADR-0021;
  - `adr/0006`, by ADR-0025;
  - `adr/0007`, by ADR-0013 and ADR-0015;
  - `adr/0008`, by ADR-0014;
  - `adr/0013`, `adr/0015` and `adr/0016`, by ADR-0020;
  - `adr/0014`, by ADR-0022.

## New Durable ADRs Created

- None - no major durable architectural decisions were introduced.
