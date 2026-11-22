'use strict';

// The scenarios that can only be checked on Windows, because they run the
// release's .bat with cmd.exe (design D7 of windows-global-distro). They are
// chosen by name: the Gherkin of the specs is extracted from their Markdown,
// whose headings become the Scenario: lines, so a scenario cannot carry a tag.
// The default profile and `specs` leave them out; the `windows` profile runs
// only them, in the release workflow's Windows job.

const WINDOWS_SCENARIOS = [
  // windows-global-install
  'La release trae el instalador de su versión',
  'Sin git ni Node en la máquina',
  'Dónde queda cada cosa',
  'Ya está instalada la misma versión',
  'Hay instalada otra versión',
  'La descarga falla',
  // slim-template
  'Ciclo de un change en un proyecto adelgazado',
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ANY = `(?:${WINDOWS_SCENARIOS.map(escape).join('|')})`;

module.exports = {
  WINDOWS_SCENARIOS,
  // For the `name` option of cucumber-js: regular expressions on the scenario name
  onlyWindows: [`^${ANY}$`],
  notWindows: [`^(?!${ANY}$)`],
};
