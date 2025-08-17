import { 
    App, 
    Plugin, 
    PluginSettingTab, 
    TFile, 
    TFolder,
    Menu,
    MenuItem,
    Notice,
    WorkspaceLeaf,
    MarkdownView
} from 'obsidian';

import { HandwriteSettings, DEFAULT_SETTINGS } from './src/config/settings';
import { HandwriteSettingTab } from './src/ui/SettingsTab';
import { ProcessingModal } from './src/ui/ProcessingModal';
import { FileProcessor } from './src/processor/fileProcessor';

export default class HandwritePlugin extends Plugin {
    settings: HandwriteSettings;

    async onload() {
        await this.loadSettings();

        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon('image-file', 'Process handwritten notes', () => {
            this.showFileSelector();
        });
        ribbonIconEl.addClass('handwrite-ribbon-icon');

        // Add command to process current file
        this.addCommand({
            id: 'process-current-file',
            name: 'Process current file',
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file && this.isSupportedFile(file)) {
                    if (!checking) {
                        this.processFiles([file]);
                    }
                    return true;
                }
                return false;
            }
        });

        // Add command to process folder
        this.addCommand({
            id: 'process-folder',
            name: 'Process folder',
            callback: () => {
                this.showFileSelector();
            }
        });

        // Add settings tab
        this.addSettingTab(new HandwriteSettingTab(this.app, this));

        // Register file menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
                if (this.isSupportedFile(file)) {
                    menu.addItem((item: MenuItem) => {
                        item
                            .setTitle('Process with Handwrite OCR')
                            .setIcon('image-file')
                            .onClick(() => {
                                this.processFiles([file]);
                            });
                    });
                }
            })
        );

        // Register folder menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file: TFolder) => {
                if (file instanceof TFolder) {
                    const supportedFiles = FileProcessor.getSupportedFiles(file, this.app.vault);
                    if (supportedFiles.length > 0) {
                        menu.addItem((item: MenuItem) => {
                            item
                                .setTitle(`Process ${supportedFiles.length} files with Handwrite OCR`)
                                .setIcon('image-file')
                                .onClick(() => {
                                    this.processFiles(supportedFiles);
                                });
                        });
                    }
                }
            })
        );

        // Log successful load
        console.log('Handwrite OCR plugin loaded');
    }

    onunload() {
        console.log('Handwrite OCR plugin unloaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private isSupportedFile(file: TFile): boolean {
        const supportedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
        return supportedExtensions.includes(file.extension.toLowerCase());
    }

    private async processFiles(files: TFile[]) {
        if (!this.settings.geminiApiKey) {
            new Notice('Please set your Gemini API key in the plugin settings');
            // Open settings
            (this.app as any).setting.open();
            (this.app as any).setting.openTabById('handwrite-ocr');
            return;
        }

        if (files.length === 0) {
            new Notice('No supported files selected');
            return;
        }

        const modal = new ProcessingModal(this.app, files, this.settings);
        modal.open();
    }

    private showFileSelector() {
        const modal = new FileSelectorModal(this.app, (files: TFile[]) => {
            if (files.length > 0) {
                this.processFiles(files);
            }
        });
        modal.open();
    }

}

// File Selector Modal
import { Modal, Setting } from 'obsidian';
import { FolderSuggestModal } from './src/ui/FolderSuggestModal';

class FileSelectorModal extends Modal {
    private onSelect: (files: TFile[]) => void;
    private selectedFiles: Set<TFile> = new Set();
    private folderPath: string = '';

    constructor(app: App, onSelect: (files: TFile[]) => void) {
        super(app);
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('handwrite-modal');
        contentEl.addClass('handwrite-modal--file-selector');

        contentEl.createEl('h2', { text: 'Select Files to Process' });

        new Setting(contentEl)
            .setName('Folder')
            .setDesc('Select a folder to process all supported files within it')
            .addText(text => text
                .setPlaceholder('Click Browse to select folder')
                .setValue(this.folderPath)
                .setDisabled(true))
            .addButton(button => button
                .setButtonText('Browse')
                .onClick(() => {
                    new FolderSuggestModal(this.app, (folder) => {
                        this.folderPath = folder.path;
                        this.updateFileList();
                        // Update the disabled text input to show selected folder
                        const textInput = contentEl.querySelector('input[type="text"]') as HTMLInputElement;
                        if (textInput) {
                            textInput.value = folder.path;
                        }
                    }).open();
                }));

        const fileListContainer = contentEl.createDiv('handwrite-modal__file-list');
        this.updateFileList();

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Process Selected')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSelect(Array.from(this.selectedFiles));
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }));
    }

    private updateFileList() {
        const container = this.contentEl.querySelector('.handwrite-modal__file-list') as HTMLElement;
        if (!container) return;

        container.empty();

        const folder = this.app.vault.getAbstractFileByPath(this.folderPath);
        if (!(folder instanceof TFolder)) {
            container.createEl('p', { 
                text: 'Enter a valid folder path',
                cls: 'handwrite-modal__empty-state'
            });
            return;
        }

        const files = FileProcessor.getSupportedFiles(folder, this.app.vault);
        if (files.length === 0) {
            container.createEl('p', { 
                text: 'No supported files found in this folder',
                cls: 'handwrite-modal__empty-state'
            });
            return;
        }

        const selectAll = new Setting(container as HTMLElement)
            .setName(`Select all (${files.length} files)`)
            .addToggle(toggle => toggle
                .setValue(false)
                .onChange(value => {
                    if (value) {
                        files.forEach(file => this.selectedFiles.add(file));
                    } else {
                        this.selectedFiles.clear();
                    }
                    this.updateFileList();
                }));

        files.forEach(file => {
            new Setting(container)
                .setName(file.name)
                .setDesc(file.path)
                .addToggle(toggle => toggle
                    .setValue(this.selectedFiles.has(file))
                    .onChange(value => {
                        if (value) {
                            this.selectedFiles.add(file);
                        } else {
                            this.selectedFiles.delete(file);
                        }
                    }));
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}