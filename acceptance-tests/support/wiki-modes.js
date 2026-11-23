'use strict';

// The modes of the wiki (design D1 and D2 of add-wiki-lite-mode), as the
// suite needs them to know what the session bootstrap core delivers:
//   - the effective mode of an engine.json: "lite" only when it declares
//     exactly "lite"; anything else, or nothing, is full
//   - the text of a mode: a guide or reminder file without the lines of the
//     other mode's blocks and without the block markers, each one alone on
//     its line. Malformed blocks (unclosed, of a mode that does not exist,
//     nested, or a close without an open) throw: the core delivers nothing

const MODES = ['full', 'lite'];
const BLOCK_PREFIX = '<!-- wiki-mode:';
const BLOCK_END = '<!-- wiki-mode:end -->';

function effectiveMode(engineConfig = {}) {
  return engineConfig.mode === 'lite' ? 'lite' : 'full';
}

function modeText(text, mode) {
  if (!MODES.includes(mode)) throw new Error(`'${mode}' is not a wiki mode (${MODES.join(', ')})`);
  let block = null;
  const kept = [];
  text.split('\n').forEach((line, index) => {
    const where = `line ${index + 1}: ${line}`;
    if (line.includes(BLOCK_PREFIX)) {
      if (line === BLOCK_END) {
        if (block === null) throw new Error(`wiki mode block closed without an open, ${where}`);
        block = null;
        return;
      }
      const opened = MODES.find((m) => line === `${BLOCK_PREFIX}${m} -->`);
      if (!opened) throw new Error(`unknown wiki mode marker, ${where}`);
      if (block !== null) throw new Error(`wiki mode block inside another, ${where}`);
      block = opened;
      return;
    }
    if (block === null || block === mode) kept.push(line);
  });
  if (block !== null) throw new Error(`unclosed wiki mode block (${block})`);
  return kept.join('\n');
}

module.exports = { MODES, effectiveMode, modeText };
