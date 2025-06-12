# RetrospectAI - Obsidian Plugin

## Development & Testing

### Manual Testing Procedures

#### Setup Test Environment
1. **Build the plugin**: `npm run build`
2. **Deploy to test vault**: `npm run deploy:test`
3. **Open test vault** in Obsidian
4. **Enable the plugin** in Settings > Community Plugins

#### Basic Functionality Tests
- [ ] **Plugin loads without errors** (check console)
- [ ] **Ribbon icon appears** in left sidebar with "brain" icon
- [ ] **Clicking ribbon icon** triggers handler (check console logs)
- [ ] **Plugin unloads cleanly** when disabled
- [ ] **No memory leaks** after multiple load/unload cycles

#### Error Handling Tests
- [ ] **Logger outputs** appear in console with proper formatting
- [ ] **Error scenarios** are caught and logged appropriately
- [ ] **User notifications** appear for user-facing errors

#### Development Workflow
1. **Hot reloading**: Changes auto-rebuild and reload in test vault
2. **Console monitoring**: Watch for errors during development
3. **Settings validation**: Verify plugin settings save/load correctly

### Test Vault Structure
```
.obsidian-test/
├── .obsidian/
│   └── plugins/
│   └── retrospectai/
│   ├── main.js
│   └── manifest.json
├── Daily Notes/
│   ├── 2024-01-01.md
│   └── 2024-01-02.md
└── Sample Notes/
    ├── Meeting Notes.md
    └── Project Ideas.md
```