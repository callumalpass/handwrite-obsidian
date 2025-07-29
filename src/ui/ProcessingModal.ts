import { App, Modal, TFile, TFolder, Setting, Notice } from 'obsidian';
import { FileProcessor, BatchProcessingProgress, ProcessingResult } from '../processor/fileProcessor';
import { HandwriteSettings } from '../config/settings';

export class ProcessingModal extends Modal {
    private files: TFile[];
    private processor: FileProcessor;
    private settings: HandwriteSettings;
    private progressBar: HTMLProgressElement;
    private statusEl: HTMLElement;
    private resultsEl: HTMLElement;
    private isProcessing: boolean = false;

    constructor(app: App, files: TFile[], settings: HandwriteSettings) {
        super(app);
        this.files = files;
        this.settings = settings;
        this.processor = new FileProcessor(app.vault, app.fileManager, settings);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('handwrite-modal');
        contentEl.addClass('handwrite-modal--processing');

        // Header
        contentEl.createEl('h2', { 
            text: 'Processing Handwritten Notes',
            cls: 'handwrite-modal__header'
        });

        // File count
        contentEl.createEl('p', {
            text: `Processing ${this.files.length} file${this.files.length > 1 ? 's' : ''}`,
            cls: 'handwrite-modal__file-count'
        });

        // Progress section
        const progressSection = contentEl.createDiv('handwrite-modal__progress-section');
        
        this.statusEl = progressSection.createEl('p', {
            text: 'Ready to process. Click "Start Processing" to begin.',
            cls: 'handwrite-modal__status'
        });

        // Progress bar container
        const progressContainer = progressSection.createDiv('handwrite-modal__progress-container');
        this.progressBar = progressContainer.createEl('progress', {
            cls: 'handwrite-modal__progress-bar',
            attr: { max: '100', value: '0' }
        });

        // Results section
        this.resultsEl = contentEl.createDiv('handwrite-modal__results');
        this.resultsEl.createEl('h3', {
            text: 'Results',
            cls: 'handwrite-modal__results-header'
        });

        const resultsList = this.resultsEl.createEl('ul', {
            cls: 'handwrite-modal__results-list'
        });

        // Buttons
        const buttonContainer = contentEl.createDiv('handwrite-modal__buttons');
        
        const processButton = buttonContainer.createEl('button', {
            text: 'Start Processing',
            cls: 'handwrite-modal__button handwrite-modal__button--primary'
        });

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'handwrite-modal__button handwrite-modal__button--secondary'
        });

        // Event handlers
        processButton.addEventListener('click', async () => {
            if (this.isProcessing) return;
            
            this.isProcessing = true;
            processButton.setText('Processing...');
            processButton.disabled = true;

            await this.processFiles(resultsList);

            processButton.setText('Done');
            cancelButton.setText('Close');
        });

        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    private async processFiles(resultsList: HTMLElement) {
        const results = await this.processor.processBatch(
            this.files,
            (progress: BatchProcessingProgress) => {
                const percentage = (progress.current / progress.total) * 100;
                this.progressBar.value = percentage;
                
                if (progress.currentFile) {
                    this.statusEl.setText(`Processing: ${progress.currentFile}`);
                } else {
                    this.statusEl.setText(`Completed: ${progress.current} / ${progress.total}`);
                }
            },
            (file: TFile, result: ProcessingResult) => {
                const listItem = resultsList.createEl('li', {
                    cls: 'handwrite-modal__result-item'
                });

                const icon = listItem.createEl('span', {
                    cls: `handwrite-modal__result-icon handwrite-modal__result-icon--${result.success ? 'success' : 'error'}`
                });
                icon.setText(result.success ? '✓' : '✗');

                const text = listItem.createEl('span', {
                    cls: 'handwrite-modal__result-text'
                });
                
                if (result.success) {
                    text.setText(`${file.name} → ${result.filePath}`);
                } else {
                    text.setText(`${file.name}: ${result.error}`);
                }
            }
        );

        // Show summary
        const successful = Array.from(results.values()).filter(r => r.success).length;
        const failed = results.size - successful;

        this.statusEl.setText(`Processing complete: ${successful} successful, ${failed} failed`);
        
        if (successful > 0) {
            new Notice(`Successfully processed ${successful} file${successful > 1 ? 's' : ''}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}