/**
 * Mock Obsidian module for testing
 */

class Notice {
  constructor(message) {
    console.log(`Notice: ${message}`);
  }
}

class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
  }

  async onload() {
    // Mock onload
  }

  onunload() {
    // Mock onunload
  }

  async loadData() {
    return {};
  }

  async saveData(data) {
    // Mock save
  }

  addSettingTab(tab) {
    // Mock add setting tab
  }

  addCommand(command) {
    // Mock add command
  }

  registerEvent(event) {
    // Mock register event
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: () => {},
      createEl: () => ({
        textContent: '',
        setAttribute: () => {},
        addEventListener: () => {}
      }),
      createDiv: function() { return this; },
      addClass: () => {}
    };
  }

  display() {
    // Mock display
  }

  hide() {
    // Mock hide
  }
}

class Setting {
  constructor(containerEl) {
    this.containerEl = containerEl;
    return this;
  }

  setName(name) {
    this.name = name;
    return this;
  }

  setDesc(desc) {
    this.desc = desc;
    return this;
  }

  addText(callback) {
    const textComponent = {
      setPlaceholder: function() { return this; },
      setValue: function() { return this; },
      onChange: function() { return this; }
    };
    if (callback) callback(textComponent);
    return this;
  }

  addToggle(callback) {
    const toggleComponent = {
      setValue: function() { return this; },
      onChange: function() { return this; }
    };
    if (callback) callback(toggleComponent);
    return this;
  }

  addDropdown(callback) {
    const dropdownComponent = {
      addOption: function() { return this; },
      setValue: function() { return this; },
      onChange: function() { return this; }
    };
    if (callback) callback(dropdownComponent);
    return this;
  }

  addSlider(callback) {
    const sliderComponent = {
      setLimits: function() { return this; },
      setValue: function() { return this; },
      setDynamicTooltip: function() { return this; },
      onChange: function() { return this; }
    };
    if (callback) callback(sliderComponent);
    return this;
  }

  addButton(callback) {
    const buttonComponent = {
      setButtonText: function() { return this; },
      setCta: function() { return this; },
      setDisabled: function() { return this; },
      onClick: function() { return this; }
    };
    if (callback) callback(buttonComponent);
    return this;
  }
}

class TFile {
  constructor(path) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = 'md';
    this.stat = {
      mtime: Date.now(),
      size: 1000,
      ctime: Date.now()
    };
  }
}

class Vault {
  constructor() {
    this.adapter = {
      stat: () => Promise.resolve(null),
      read: () => Promise.resolve('mock content'),
      constructor: {
        prototype: {
          constructor: function() {}
        }
      }
    };
  }

  getMarkdownFiles() {
    return [];
  }

  getFiles() {
    return [];
  }

  getAbstractFileByPath(path) {
    return null;
  }

  async read(file) {
    return 'mock file content';
  }
}

class App {
  constructor() {
    this.vault = new Vault();
  }
}

class Modal {
  constructor(app) {
    this.app = app;
    this.contentEl = {
      empty: () => {},
      createEl: () => ({
        textContent: '',
        setAttribute: () => {},
        addEventListener: () => {}
      }),
      createDiv: function() { return this; },
      addClass: () => {}
    };
  }

  open() {
    this.onOpen();
  }

  close() {
    this.onClose();
  }

  onOpen() {
    // Override in subclasses
  }

  onClose() {
    // Override in subclasses
  }
}

module.exports = {
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Vault,
  App,
  Modal
}; 