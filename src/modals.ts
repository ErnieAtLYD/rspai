import { App, Modal, Setting, Notice } from "obsidian";
import { EncryptionService, ErrorHandlingService } from "./services";

/**
 * Modal for prompting user for master password
 */
export class MasterPasswordModal extends Modal {
    private password: string = "";
    private onSubmit: (password: string | null) => void;

    constructor(app: App, onSubmit: (password: string | null) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Enter Master Password" });
        
        contentEl.createEl("p", { 
            text: "Please enter your master password to decrypt your API key.",
            cls: "setting-item-description"
        });

        new Setting(contentEl)
            .setName("Master Password")
            .setDesc("The password you set up for encrypting your API key")
            .addText((text) => {
                text.setPlaceholder("Enter master password")
                    .setValue(this.password)
                    .onChange((value) => {
                        this.password = value;
                    });
                text.inputEl.type = "password";
                text.inputEl.addEventListener("keypress", (e) => {
                    if (e.key === "Enter") {
                        this.submit();
                    }
                });
                
                // Focus the input field
                setTimeout(() => text.inputEl.focus(), 100);
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Unlock")
                    .setCta()
                    .onClick(() => {
                        this.submit();
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Cancel")
                    .onClick(() => {
                        this.close();
                        this.onSubmit(null);
                    })
            );
    }

    private submit() {
        if (!this.password) {
            return;
        }

        this.close();
        this.onSubmit(this.password);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for setting up encryption for the first time
 */
export class EncryptionSetupModal extends Modal {
    private password: string = "";
    private confirmPassword: string = "";
    private apiKey: string = "";
    private onSubmit: (password: string | null, apiKey: string | null) => void;
    private encryptionService: EncryptionService;

    constructor(app: App, onSubmit: (password: string | null, apiKey: string | null) => void, errorHandler: ErrorHandlingService) {
        super(app);
        this.onSubmit = onSubmit;
        this.encryptionService = new EncryptionService(app, {}, errorHandler);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Setup Encrypted Storage" });
        
        contentEl.createEl("p", { 
            text: "Encrypt your API key with a master password for enhanced security. This password will be required each time you use the plugin.",
            cls: "setting-item-description"
        });

        // Security warning
        const warningEl = contentEl.createDiv({ cls: "callout callout-warning" });
        warningEl.createEl("div", { text: "⚠️ Security Warning", cls: "callout-title" });
        warningEl.createEl("p", { text: "Choose a strong master password and keep it safe. If you lose this password, you will not be able to recover your encrypted API key." });

        new Setting(contentEl)
            .setName("OpenAI API Key")
            .setDesc("Your OpenAI API key to encrypt")
            .addText((text) => {
                text.setPlaceholder("sk-...")
                    .setValue(this.apiKey)
                    .onChange((value) => {
                        this.apiKey = value;
                    });
                text.inputEl.type = "password";
            });

        new Setting(contentEl)
            .setName("Master Password")
            .setDesc("Choose a strong password to encrypt your API key")
            .addText((text) => {
                text.setPlaceholder("Enter master password")
                    .setValue(this.password)
                    .onChange((value) => {
                        this.password = value;
                        this.validatePasswords();
                    });
                text.inputEl.type = "password";
            });

        new Setting(contentEl)
            .setName("Confirm Password")
            .setDesc("Re-enter your master password")
            .addText((text) => {
                text.setPlaceholder("Confirm master password")
                    .setValue(this.confirmPassword)
                    .onChange((value) => {
                        this.confirmPassword = value;
                        this.validatePasswords();
                    });
                text.inputEl.type = "password";
                text.inputEl.addEventListener("keypress", (e) => {
                    if (e.key === "Enter") {
                        this.submit();
                    }
                });
            });

        // Password validation feedback
        const validationEl = contentEl.createDiv({ cls: "password-validation" });
        this.updateValidationFeedback(validationEl);

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Setup Encryption")
                    .setCta()
                    .onClick(() => {
                        this.submit();
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Cancel")
                    .onClick(() => {
                        this.close();
                        this.onSubmit(null, null);
                    })
            );
    }

    private validatePasswords() {
        const validationEl = this.contentEl.querySelector(".password-validation");
        if (validationEl) {
            this.updateValidationFeedback(validationEl as HTMLElement);
        }
    }

    private updateValidationFeedback(validationEl: HTMLElement) {
        validationEl.empty();

        if (!this.password) {
            return;
        }

        const validation = this.encryptionService.validatePassword(this.password);
        
        if (!validation.valid) {
            validationEl.createEl("div", { 
                text: validation.message, 
                cls: "password-validation-error" 
            });
        } else if (this.password !== this.confirmPassword && this.confirmPassword) {
            validationEl.createEl("div", { 
                text: "Passwords do not match", 
                cls: "password-validation-error" 
            });
        } else if (this.password === this.confirmPassword && this.confirmPassword) {
            validationEl.createEl("div", { 
                text: "✓ Password is valid", 
                cls: "password-validation-success" 
            });
        }
    }

    private async submit() {
        if (!this.apiKey) {
            return;
        }

        if (!this.password || !this.confirmPassword) {
            return;
        }

        if (this.password !== this.confirmPassword) {
            return;
        }

        const validation = this.encryptionService.validatePassword(this.password);
        if (!validation.valid) {
            return;
        }

        this.close();
        this.onSubmit(this.password, this.apiKey);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for encryption management settings
 */
export class EncryptionManagementModal extends Modal {
    private plugin: any; // JournalReflectionPlugin type
    private onCloseCallback: () => void;

    constructor(app: App, plugin: any, onCloseCallback: () => void) {
        super(app);
        this.plugin = plugin;
        this.onCloseCallback = onCloseCallback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Encryption Management" });
        
        const isEncrypted = this.plugin.settings.encryptionEnabled;
        
        if (isEncrypted) {
            contentEl.createEl("p", { 
                text: "Your API key is currently encrypted and protected by a master password.",
                cls: "setting-item-description"
            });

            // Status indicator
            const statusEl = contentEl.createDiv({ cls: "encryption-status encrypted" });
            statusEl.createEl("span", { text: "🔒 Encrypted", cls: "status-text" });

            new Setting(contentEl)
                .setName("Disable Encryption")
                .setDesc("Convert back to plain text storage (not recommended)")
                .addButton((btn) =>
                    btn
                        .setButtonText("Disable Encryption")
                        .setWarning()
                        .onClick(async () => {
                            await this.plugin.disableEncryption();
                            this.close();
                            this.onCloseCallback();
                        })
                );

            new Setting(contentEl)
                .setName("Test Decryption")
                .setDesc("Test if you can decrypt your API key with the current master password")
                .addButton((btn) =>
                    btn
                        .setButtonText("Test Decryption")
                        .onClick(async () => {
                            const decrypted = await this.plugin.getDecryptedApiKey();
                            if (decrypted) {
                                new Notice("✓ Decryption successful!");
                            } else {
                                new Notice("✗ Decryption failed!");
                            }
                        })
                );
        } else {
            contentEl.createEl("p", { 
                text: "Your API key is currently stored in plain text. Enable encryption for better security.",
                cls: "setting-item-description"
            });

            // Status indicator
            const statusEl = contentEl.createDiv({ cls: "encryption-status plain" });
            statusEl.createEl("span", { text: "🔓 Plain Text", cls: "status-text" });

            new Setting(contentEl)
                .setName("Enable Encryption")
                .setDesc("Encrypt your API key with a master password")
                .addButton((btn) =>
                    btn
                        .setButtonText("Setup Encryption")
                        .setCta()
                        .onClick(async () => {
                            const success = await this.plugin.setupEncryption();
                            if (success) {
                                this.close();
                                this.onCloseCallback();
                            }
                        })
                );
        }

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Close")
                    .onClick(() => {
                        this.close();
                        this.onCloseCallback();
                    })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onCloseCallback();
    }
}