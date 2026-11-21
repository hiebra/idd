'use strict';

const { After } = require('@cucumber/cucumber');

// Each scenario works in its own temporary directory, created by the World
After(function () {
  this.cleanUp();
});
