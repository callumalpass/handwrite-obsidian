import { App, SuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends SuggestModal<TFolder> {
    private onSelect: (folder: TFolder) => void;

    constructor(app: App, onSelect: (folder: TFolder) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Type to search for folders...');
    }

    getSuggestions(query: string): TFolder[] {
        const folders = this.app.vault.getAllLoadedFiles()
            .filter(file => file instanceof TFolder) as TFolder[];
        
        if (!query) {
            return folders.slice(0, 20); // Limit to first 20 folders if no query
        }

        return folders
            .filter(folder => folder.path.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 20); // Limit results for performance
    }

    renderSuggestion(folder: TFolder, el: HTMLElement) {
        el.createEl('div', { text: folder.path });
        
        // Add a small indicator showing the number of supported files
        const supportedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
        const supportedFiles = this.app.vault.getFiles().filter(file => 
            file.path.startsWith(folder.path + '/') && 
            supportedExtensions.includes(file.extension.toLowerCase())
        );
        
        if (supportedFiles.length > 0) {
            el.createEl('small', { 
                text: ` (${supportedFiles.length} supported file${supportedFiles.length === 1 ? '' : 's'})`,
                cls: 'mod-faint'
            });
        }
    }

    onChooseSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
        this.onSelect(folder);
    }
}