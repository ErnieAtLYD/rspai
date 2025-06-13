/**
 * Mock Obsidian module for testing
 */

class Notice {
  constructor(message) {
    console.log(`Notice: ${message}`);
  }
}

module.exports = {
  Notice
}; 