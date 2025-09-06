  // src/ui/settings/FolderValidator.ts - Extracted validation logic
  import { App, Setting } from "obsidian";
  
  export class FolderValidator {
    private app: App;
  
    constructor(app: App) {
      this.app = app;
    }
  
    validateFolderPaths(setting: Setting, folderPaths: string[]): void {
      // Validation logic extracted from original
      // ... implementation details
    }
  
    async validateOrCreateFolder(setting: Setting, folderPath: string): Promise<void> {
      // Validation/creation logic extracted from original
      // ... implementation details
    }
  
    private addValidationIcon(setting: Setting, type: "success" | "error" | "info", tooltip: string): void {
      // Icon creation logic extracted from original
      // ... implementation details
    }
  }
