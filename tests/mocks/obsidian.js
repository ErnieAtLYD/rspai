// Mock Obsidian API for testing
class App {
    constructor() {
        this.vault = new Vault();
    }
}

class Vault {
    constructor() {
        this.adapter = new FileSystemAdapter();
    }
}

class FileSystemAdapter {
    async exists(path) {
        return true;
    }
    
    async read(path) {
        return 'mock file content';
    }
    
    async write(path, content) {
        return;
    }
}

class Plugin {
    constructor(app, manifest) {
        this.app = app;
        this.manifest = manifest;
    }
    
    async loadData() {
        return {};
    }
    
    async saveData(data) {
        return;
    }
}

class Setting {
    constructor(containerEl) {
        this.containerEl = containerEl;
        this.settingEl = {
            querySelector: () => null,
            createDiv: (attrs) => ({
                classList: { add: () => {} },
                textContent: '',
                title: '',
                style: {},
                appendChild: () => {}
            })
        };
    }
    
    setName(name) {
        return this;
    }
    
    setDesc(desc) {
        return this;
    }
    
    addText(callback) {
        const textComponent = {
            setPlaceholder: () => textComponent,
            setValue: () => textComponent,
            onChange: () => textComponent,
            setDisabled: () => textComponent,
            inputEl: { type: 'text' }
        };
        callback(textComponent);
        return this;
    }
    
    addToggle(callback) {
        const toggleComponent = {
            setValue: () => toggleComponent,
            onChange: () => toggleComponent
        };
        callback(toggleComponent);
        return this;
    }
    
    addDropdown(callback) {
        const dropdownComponent = {
            addOption: () => dropdownComponent,
            setValue: () => dropdownComponent,
            onChange: () => dropdownComponent
        };
        callback(dropdownComponent);
        return this;
    }
    
    addSlider(callback) {
        const sliderComponent = {
            setLimits: () => sliderComponent,
            setValue: () => sliderComponent,
            onChange: () => sliderComponent,
            setDynamicTooltip: () => sliderComponent
        };
        callback(sliderComponent);
        return this;
    }
    
    addButton(callback) {
        const buttonComponent = {
            setButtonText: () => buttonComponent,
            onClick: () => buttonComponent,
            setDisabled: () => buttonComponent
        };
        callback(buttonComponent);
        return this;
    }
}

class Notice {
    constructor(message) {
        this.message = message;
    }
}

class Modal {
    constructor(app) {
        this.app = app;
        this.containerEl = document.createElement('div');
        this.contentEl = document.createElement('div');
    }
    
    open() {
        this.onOpen();
    }
    
    close() {
        this.onClose();
    }
    
    onOpen() {}
    onClose() {}
}

class PluginSettingTab {
    constructor(app, plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = document.createElement('div');
    }
    
    display() {}
}

class TFile {
    constructor(path) {
        this.path = path;
        this.name = path.split('/').pop();
        this.extension = path.split('.').pop();
        this.stat = { mtime: Date.now(), ctime: Date.now() };
    }
}

class TFolder {
    constructor(path) {
        this.path = path;
        this.name = path.split('/').pop();
        this.children = [];
    }
}

const moment = {
    unix: (timestamp) => ({
        format: () => new Date(timestamp * 1000).toISOString(),
        valueOf: () => timestamp * 1000
    })
};

module.exports = {
    App,
    Vault,
    FileSystemAdapter,
    Plugin,
    Setting,
    Notice,
    Modal,
    PluginSettingTab,
    TFile,
    TFolder,
    moment
};

// Mock JSDOM environment
if (typeof document === 'undefined') {
    global.document = {
        createElement: (tagName) => ({
            tagName: tagName.toUpperCase(),
            style: {},
            classList: {
                add: () => {},
                remove: () => {},
                contains: () => false,
                toggle: () => {}
            },
            setAttribute: () => {},
            getAttribute: () => null,
            appendChild: () => {},
            removeChild: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            removeEventListener: () => {},
            createEl: function(tagName, attrs) {
                const el = document.createElement(tagName);
                el.style = {};
                if (attrs) {
                    if (attrs.text) el.textContent = attrs.text;
                    if (attrs.cls) el.className = attrs.cls;
                }
                return el;
            },
            createDiv: function(attrs) {
                const div = this.createEl('div', attrs);
                div.style = {};
                div.createSpan = function(attrs) {
                    const span = document.createElement('span');
                    if (attrs && attrs.text) span.textContent = attrs.text;
                    return span;
                };
                div.createEl = function(tagName, attrs) {
                    const el = document.createElement(tagName);
                    el.style = {};
                    if (attrs) {
                        if (attrs.text) el.textContent = attrs.text;
                        if (attrs.cls) el.className = attrs.cls;
                        if (attrs.href) el.href = attrs.href;
                        if (attrs.attr) {
                            Object.keys(attrs.attr).forEach(key => {
                                el.setAttribute(key, attrs.attr[key]);
                            });
                        }
                    }
                    return el;
                };
                return div;
            },
            empty: function() {
                this.textContent = '';
            },
            appendText: function(text) {
                this.textContent += text;
            }
        })
    };
}