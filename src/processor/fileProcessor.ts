import { TFile, TFolder, Vault, normalizePath, FileManager } from 'obsidian';
import { GeminiClient, StructuredResponse } from '../gemini/client';
import { HandwriteSettings } from '../config/settings';
import { TemplateRenderer } from '../template/renderer';

export interface ProcessingResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface BatchProcessingProgress {
    current: number;
    total: number;
    currentFile: string;
}

export class FileProcessor {
    private vault: Vault;
    private fileManager: FileManager;
    private settings: HandwriteSettings;
    private geminiClient: GeminiClient;

    constructor(vault: Vault, fileManager: FileManager, settings: HandwriteSettings) {
        this.vault = vault;
        this.fileManager = fileManager;
        this.settings = settings;
        this.geminiClient = new GeminiClient(settings.geminiApiKey, settings.geminiModel, settings.debugMode);
    }

    async processFile(file: TFile, progressCallback?: (progress: string) => void): Promise<ProcessingResult> {
        try {
            const fileExt = file.extension.toLowerCase();
            
            if (!this.isSupportedFile(fileExt)) {
                return {
                    success: false,
                    error: `Unsupported file type: ${fileExt}`
                };
            }

            progressCallback?.(`Reading ${file.name}...`);
            const fileData = await this.vault.readBinary(file);
            const uint8Array = new Uint8Array(fileData);

            progressCallback?.(`Processing with Gemini...`);
            let result: StructuredResponse;
            
            if (fileExt === 'pdf') {
                result = await this.geminiClient.extractStructuredTextFromPDF(
                    uint8Array,
                    this.settings.prompt,
                    this.settings.extractableVariables
                );
            } else {
                const mimeType = this.getMimeType(fileExt);
                result = await this.geminiClient.extractStructuredTextFromImage(
                    uint8Array,
                    mimeType,
                    this.settings.prompt,
                    this.settings.extractableVariables
                );
            }

            if (!result.content || result.content.trim() === '') {
                return {
                    success: false,
                    error: 'No text extracted from file'
                };
            }

            progressCallback?.(`Creating note...`);
            const outputPath = await this.createNote(file, result);

            return {
                success: true,
                filePath: outputPath
            };
        } catch (error) {
            if (this.settings.debugMode) {
                console.error('Error processing file:', error);
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async processBatch(
        files: TFile[], 
        progressCallback?: (progress: BatchProcessingProgress) => void,
        resultCallback?: (file: TFile, result: ProcessingResult) => void
    ): Promise<Map<string, ProcessingResult>> {
        const results = new Map<string, ProcessingResult>();
        const workers = this.settings.concurrentWorkers;
        
        // Create a queue of files to process
        const queue = [...files];
        const processing = new Set<Promise<void>>();

        let completed = 0;

        const processNext = async () => {
            const file = queue.shift();
            if (!file) return;

            progressCallback?.({
                current: completed + processing.size,
                total: files.length,
                currentFile: file.name
            });

            const result = await this.processFile(file);
            results.set(file.path, result);
            completed++;
            
            resultCallback?.(file, result);
            
            progressCallback?.({
                current: completed,
                total: files.length,
                currentFile: ''
            });
        };

        // Start initial workers
        for (let i = 0; i < Math.min(workers, files.length); i++) {
            const workerPromise = (async () => {
                while (queue.length > 0) {
                    await processNext();
                }
            })();
            processing.add(workerPromise);
        }

        // Wait for all workers to complete
        await Promise.all(processing);

        return results;
    }

    private async createNote(sourceFile: TFile, result: StructuredResponse): Promise<string> {
        // Generate filename using extracted variables only
        const allVariables = result.extractedVariables;
        
        const outputFilename = TemplateRenderer.generateFilename(
            this.settings.filenameTemplate,
            sourceFile.basename,
            allVariables
        );

        // Ensure output folder exists
        const outputFolder = normalizePath(this.settings.outputFolder);
        const folder = this.vault.getAbstractFileByPath(outputFolder);
        if (!folder) {
            await this.vault.createFolder(outputFolder);
        }

        const outputPath = normalizePath(`${outputFolder}/${outputFilename}`);

        // Generate proper markdown link for the source file
        const markdownLink = this.fileManager.generateMarkdownLink(sourceFile, outputPath);
        
        // Create template data
        const templateData = TemplateRenderer.createTemplateData(
            result.content,
            result.tags,
            sourceFile.basename,
            sourceFile.path,
            markdownLink,
            1, // For now, we don't track page count in Obsidian
            this.settings.geminiModel,
            {},
            result.extractedVariables
        );

        // Render content
        const content = TemplateRenderer.renderTemplate(
            this.settings.templateContent,
            templateData
        );

        // Create or modify the file
        const existingFile = this.vault.getAbstractFileByPath(outputPath);
        if (existingFile instanceof TFile) {
            await this.vault.process(existingFile, () => content);
        } else {
            await this.vault.create(outputPath, content);
        }

        return outputPath;
    }

    private isSupportedFile(extension: string): boolean {
        const supported = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
        return supported.includes(extension.toLowerCase());
    }

    private getMimeType(extension: string): string {
        const mimeTypes: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'webp': 'image/webp',
            'gif': 'image/gif'
        };
        return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
    }

    static getSupportedFiles(folder: TFolder): TFile[] {
        const supportedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
        const files: TFile[] = [];

        const collectFiles = (abstractFile: TFolder) => {
            for (const child of abstractFile.children) {
                if (child instanceof TFile) {
                    if (supportedExtensions.includes(child.extension.toLowerCase())) {
                        files.push(child);
                    }
                } else if (child instanceof TFolder) {
                    collectFiles(child);
                }
            }
        };

        collectFiles(folder);
        return files;
    }
}