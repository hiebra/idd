const { extractAll } = require('./extract-gherkin.cjs');
const { effectivePaths } = require('./openspec-effective-paths.cjs');

extractAll();

const common = {
  paths: effectivePaths(),
  import: ['support/**/*.js', 'step-definitions/**/*.js'],
  format: ['progress-bar', ['html', 'reports/cucumber-report.html']],
};

// Project addition to the skill's copy: the scenarios tagged @windows only
// run on Windows, in the release workflow's Windows job (design D7 of
// windows-global-distro)
const notWindows = { tags: 'not @windows' };

const specs = {
  ...common,
  ...notWindows,
  paths: ['.extracted/specs/**/*.feature'],
};

const windows = {
  ...common,
  tags: '@windows',
};

module.exports = { default: { ...common, ...notWindows }, specs, windows };
