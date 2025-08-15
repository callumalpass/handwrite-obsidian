import { TFile, TFolder, Vault, normalizePath, FileManager, App } from 'obsidian';
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
    private app: App;
    private vault: Vault;
    private fileManager: FileManager;
    private settings: HandwriteSettings;
    private geminiClient: GeminiClient;

    constructor(app: App, settings: HandwriteSettings) {
        this.app = app;
        this.vault = app.vault;
        this.fileManager = app.fileManager;
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

            // Move the source file if enabled
            if (this.settings.moveFilesAfterProcessing) {
                progressCallback?.(`Moving source file...`);
                await this.moveSourceFile(file);
            }

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

        // Calculate the future path of the source file if it will be moved
        let futureSourcePath = sourceFile.path;
        let markdownLink: string;
        
        if (this.settings.moveFilesAfterProcessing) {
            const processedFolder = normalizePath(this.settings.processedFilesFolder);
            futureSourcePath = normalizePath(`${processedFolder}/${sourceFile.name}`);
            // Generate the markdown link manually for the future location
            const relativePath = this.getRelativePath(outputPath, futureSourcePath);
            markdownLink = `[[${relativePath}|${sourceFile.basename}]]`;
        } else {
            // Use the standard method for files that won't be moved
            markdownLink = this.fileManager.generateMarkdownLink(sourceFile, outputPath);
        }
        
        // Merge extracted tags with default tags
        const extractedTags = result.extractedVariables.tags || [];
        const allTags = this.mergeTagsWithDefaults(extractedTags);
        
        // Update the extractedVariables with merged tags
        const mergedExtractedVariables = {
            ...result.extractedVariables,
            tags: allTags
        };
        
        // Create template data
        const templateData = TemplateRenderer.createTemplateData(
            result.content,
            allTags,
            sourceFile.basename,
            futureSourcePath,
            markdownLink,
            1, // For now, we don't track page count in Obsidian
            this.settings.geminiModel,
            {},
            mergedExtractedVariables
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

        // Auto-open the created note if enabled
        if (this.settings.autoOpenCreatedNotes) {
            const createdFile = this.vault.getAbstractFileByPath(outputPath);
            if (createdFile instanceof TFile) {
                // Open in a new leaf (tab/pane)
                this.app.workspace.getLeaf(true).openFile(createdFile);
            }
        }

        return outputPath;
    }

    private mergeTagsWithDefaults(extractedTags: any): string[] {
        // Ensure extractedTags is an array
        let tags: string[] = [];
        
        if (Array.isArray(extractedTags)) {
            tags = extractedTags;
        } else if (typeof extractedTags === 'string') {
            // Handle case where Gemini might return a single tag as a string
            tags = [extractedTags];
        }
        
        // Merge with default tags, avoiding duplicates
        const allTags = [...this.settings.defaultTags];
        
        for (const tag of tags) {
            if (typeof tag === 'string' && tag.trim() && !allTags.includes(tag)) {
                allTags.push(tag);
            }
        }
        
        return allTags;
    }

    private getRelativePath(from: string, to: string): string {
        // Simple relative path calculation
        // This is a basic implementation - Obsidian usually handles more complex cases
        const fromParts = from.split('/').slice(0, -1); // Remove filename
        const toParts = to.split('/');
        
        // Find common prefix
        let commonLength = 0;
        for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
            if (fromParts[i] === toParts[i]) {
                commonLength++;
            } else {
                break;
            }
        }
        
        // Build relative path
        const upCount = fromParts.length - commonLength;
        const downPath = toParts.slice(commonLength);
        
        const relativeParts = [];
        for (let i = 0; i < upCount; i++) {
            relativeParts.push('..');
        }
        relativeParts.push(...downPath);
        
        return relativeParts.join('/') || '.';
    }

    private async moveSourceFile(file: TFile): Promise<void> {
        try {
            // Ensure processed folder exists
            const processedFolder = normalizePath(this.settings.processedFilesFolder);
            const folder = this.vault.getAbstractFileByPath(processedFolder);
            if (!folder) {
                await this.vault.createFolder(processedFolder);
            }

            // Generate new path for the file
            const newPath = normalizePath(`${processedFolder}/${file.name}`);
            
            // Check if a file already exists at the destination
            const existingFile = this.vault.getAbstractFileByPath(newPath);
            if (existingFile) {
                // If file exists, add a timestamp to make it unique
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const nameWithoutExt = file.basename;
                const ext = file.extension;
                const uniquePath = normalizePath(`${processedFolder}/${nameWithoutExt}_${timestamp}.${ext}`);
                await this.fileManager.renameFile(file, uniquePath);
            } else {
                // Move the file
                await this.fileManager.renameFile(file, newPath);
            }
        } catch (error) {
            if (this.settings.debugMode) {
                console.error('Error moving file:', error);
            }
            throw new Error(`Failed to move file: ${error.message}`);
        }
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

    static getSupportedFiles(folder: TFolder, vault: Vault): TFile[] {
        const supportedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
        
        // Use the vault's cached file list for much better performance
        return vault.getFiles().filter(file => 
            file.path.startsWith(folder.path + '/') && // Ensure file is within the target folder
            supportedExtensions.includes(file.extension.toLowerCase())
        );
    }
}