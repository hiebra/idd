const { extractAll } = require('./extract-gherkin.cjs');
const { effectivePaths } = require('./openspec-effective-paths.cjs');

extractAll();

const common = {
  paths: effectivePaths(),
  import: ['support/**/*.js', 'step-definitions/**/*.js'],
  format: ['progress-bar', ['html', 'reports/cucumber-report.html']],
};

// Project addition to the skill's copy: the scenarios of windows-scenarios.cjs
// only run on Windows, in the release workflow's Windows job (design D7 of
// windows-global-distro); they are chosen by name, since an extracted
// scenario cannot carry a tag
const windowsScenarios = require('./windows-scenarios.cjs');

const notWindows = { name: windowsScenarios.notWindows };

const specs = {
  ...common,
  ...notWindows,
  paths: ['.extracted/specs/**/*.feature'],
};

const windows = {
  ...common,
  name: windowsScenarios.onlyWindows,
};

module.exports = { default: { ...common, ...notWindows }, specs, windows };
