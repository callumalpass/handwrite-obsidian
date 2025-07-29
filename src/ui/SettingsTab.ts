import { App, PluginSettingTab, Setting, TextAreaComponent, ToggleComponent } from 'obsidian';
import HandwritePlugin from '../../main';
import { ExtractableVariable } from '../gemini/client';
import { EXAMPLE_EXTRACTABLE_VARIABLES } from '../config/settings';

export class HandwriteSettingTab extends PluginSettingTab {
    plugin: HandwritePlugin;

    constructor(app: App, plugin: HandwritePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // API Settings Section
        this.createSection(containerEl, 'API Configuration');

        new Setting(containerEl)
            .setName('Gemini API Key')
            .setDesc('Your Google Gemini API key')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.geminiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.geminiApiKey = value;
                    await this.plugin.saveSettings();
                }))
;

        new Setting(containerEl)
            .setName('Gemini Model')
            .setDesc('The Gemini model to use for OCR')
            .addDropdown(dropdown => dropdown
                .addOption('gemini-2.0-flash-latest', 'Gemini 2.0 Flash (Recommended - Fast)')
                .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash (Latest - Thinking)')
                .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro (Most Advanced)')
                .addOption('gemini-1.5-flash-latest', 'Gemini 1.5 Flash (Legacy)')
                .addOption('gemini-1.5-pro-latest', 'Gemini 1.5 Pro (Legacy)')
                .setValue(this.plugin.settings.geminiModel)
                .onChange(async (value) => {
                    this.plugin.settings.geminiModel = value;
                    await this.plugin.saveSettings();
                }))
;

        // OCR Settings Section
        this.createSection(containerEl, 'OCR Configuration');

        const ocrPromptSetting = new Setting(containerEl)
            .setName('OCR Prompt')
            .setDesc('The prompt sent to Gemini for text extraction')
            .addTextArea(text => {
                text.setPlaceholder('Enter OCR prompt')
                    .setValue(this.plugin.settings.prompt)
                    .onChange(async (value) => {
                        this.plugin.settings.prompt = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 8;
                text.inputEl.addClass('handwrite-settings__textarea');
                return text;
            });

        // Extractable Variables Section
        this.createSection(containerEl, 'Extractable Variables');
        
        const variablesDesc = containerEl.createEl('p', {
            text: 'Define variables that Gemini will look for and extract from your handwritten notes. For example, you can ask it to find a date in the top right corner and assign it to {{date_composed}}. These extracted values can then be used in your filename and note templates.',
            cls: 'setting-item-description'
        });

        const variablesContainer = containerEl.createDiv();
        this.renderExtractableVariables(variablesContainer);

        new Setting(containerEl)
            .setName('Add Extractable Variable')
            .setDesc('Add a new variable for Gemini to extract from your documents')
            .addButton(button => button
                .setButtonText('Add Variable')
                .onClick(() => {
                    this.plugin.settings.extractableVariables.push({
                        name: '',
                        type: 'string',
                        description: ''
                    });
                    this.renderExtractableVariables(variablesContainer);
                    this.plugin.saveSettings();
                }))
;

        // Template Section
        this.createSection(containerEl, 'Template Configuration');

        const noteTemplateSetting = new Setting(containerEl)
            .setName('Note Template')
            .setDesc('')
            .addTextArea(text => {
                text.setPlaceholder('Enter template')
                    .setValue(this.plugin.settings.templateContent)
                    .onChange(async (value) => {
                        this.plugin.settings.templateContent = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 20;
                text.inputEl.addClass('handwrite-settings__textarea');
                return text;
            });

        // Add custom description with proper formatting
        const templateDesc = noteTemplateSetting.descEl;
        templateDesc.empty();
        templateDesc.createDiv({text: 'The template used to generate notes.'});
        const templateVarSection = templateDesc.createDiv({cls: 'handwrite-settings__var-section'});
        templateVarSection.createEl('strong', {text: 'Built-in variables:'});
        const templateVarList = templateDesc.createEl('ul', {cls: 'handwrite-settings__var-list'});
        
        const templateVariables = [
            ['{{content}}', 'The transcribed text'],
            ['{{tags}}', 'Array of extracted tags'],
            ['{{filename}}', 'Name of the source file'],
            ['{{relativeFilePath}}', 'Relative path to source'],
            ['{{absoluteFilePath}}', 'Absolute path to source'],
            ['{{markdownLink}}', 'Markdown link to source file'],
            ['{{dateProcessed}}', 'When the file was processed'],
            ['{{pageCount}}', 'Number of pages processed'],
            ['{{modelUsed}}', 'Gemini model used']
        ];
        
        templateVariables.forEach(([varName, desc]) => {
            const li = templateVarList.createEl('li');
            li.createEl('code', {text: varName});
            li.appendText(' - ' + desc);
        });
        
        templateDesc.createDiv({text: 'Also available: any variables extracted from your documents.'});

        const filenameSetting = new Setting(containerEl)
            .setName('Filename Template')
            .setDesc('')
            .addText(text => text
                .setPlaceholder('{{baseName}}.md')
                .setValue(this.plugin.settings.filenameTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.filenameTemplate = value;
                    await this.plugin.saveSettings();
                }));

        // Add custom description with proper formatting
        const filenameDesc = filenameSetting.descEl;
        filenameDesc.empty();
        filenameDesc.createDiv({text: 'Template for output filenames.'});
        const filenameVarSection = filenameDesc.createDiv({cls: 'handwrite-settings__var-section'});
        filenameVarSection.createEl('strong', {text: 'Built-in variables:'});
        const filenameVarList = filenameDesc.createEl('ul', {cls: 'handwrite-settings__var-list'});
        
        const filenameVariables = [
            ['{{baseName}}', 'Original filename without extension'],
            ['{{extension}}', 'Original file extension'],
            ['{{originalFilename}}', 'Full original filename'],
            ['{{dateProcessed}}', 'Processing timestamp'],
            ['{{secondsBase36}}', 'Unique identifier based on time']
        ];
        
        filenameVariables.forEach(([varName, desc]) => {
            const li = filenameVarList.createEl('li');
            li.createEl('code', {text: varName});
            li.appendText(' - ' + desc);
        });
        
        filenameDesc.createDiv({text: 'Also available: any variables extracted from your documents.'})
;

        // Output Section
        this.createSection(containerEl, 'Output Configuration');

        new Setting(containerEl)
            .setName('Output Folder')
            .setDesc('The folder where processed notes will be saved')
            .addText(text => text
                .setPlaceholder('Handwritten Notes')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
                    await this.plugin.saveSettings();
                }))
;

        // Processing Section
        this.createSection(containerEl, 'Processing Options');

        new Setting(containerEl)
            .setName('Concurrent Workers')
            .setDesc('Number of files to process simultaneously')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.concurrentWorkers)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.concurrentWorkers = value;
                    await this.plugin.saveSettings();
                }))
;

        new Setting(containerEl)
            .setName('Show Progress Bar')
            .setDesc('Display a progress bar during batch processing')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showProgressBar)
                .onChange(async (value) => {
                    this.plugin.settings.showProgressBar = value;
                    await this.plugin.saveSettings();
                }))
;

        new Setting(containerEl)
            .setName('Debug Mode')
            .setDesc('Enable debug logging to the console')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }))
;

        // Examples Section
        this.createSection(containerEl, 'Variable Examples');

        const examplesContainer = containerEl.createDiv();
        const examplesDesc = examplesContainer.createEl('p', {
            text: 'Click to add example variables:',
            cls: 'setting-item-description'
        });

        const exampleButtons = examplesContainer.createDiv({cls: 'handwrite-settings__example-buttons'});
        
        EXAMPLE_EXTRACTABLE_VARIABLES.forEach(example => {
            const button = exampleButtons.createEl('button', {
                text: example.name,
                cls: 'mod-cta'
            });
            button.addEventListener('click', () => {
                const exists = this.plugin.settings.extractableVariables.some(
                    v => v.name === example.name
                );
                if (!exists) {
                    this.plugin.settings.extractableVariables.push({ ...example });
                    this.renderExtractableVariables(variablesContainer);
                    this.plugin.saveSettings();
                }
            });
        });
    }

    private createSection(container: HTMLElement, title: string) {
        new Setting(container)
            .setName(title)
            .setHeading();
    }

    private renderExtractableVariables(container: HTMLElement) {
        container.empty();

        if (this.plugin.settings.extractableVariables.length === 0) {
            container.createEl('p', {
                text: 'No extractable variables defined. Click "Add Variable" to create one. For example, add "date_composed" to extract dates from your notes.',
                cls: 'setting-item-description'
            });
            return;
        }

        this.plugin.settings.extractableVariables.forEach((variable, index) => {
            const setting = new Setting(container)
                .addExtraButton(button => button
                    .setIcon('x')
                    .setTooltip('Remove variable')
                    .onClick(async () => {
                        this.plugin.settings.extractableVariables.splice(index, 1);
                        this.renderExtractableVariables(container);
                        await this.plugin.saveSettings();
                    }));

            // Add custom controls for the variable
            const wrapper = setting.controlEl.createDiv({cls: 'handwrite-settings__variable-controls'});
            
            // Name input
            const nameInput = wrapper.createEl('input', {
                type: 'text',
                value: variable.name,
                placeholder: 'variable_name',
                cls: 'setting-text'
            });
            nameInput.addClass('handwrite-settings__variable-name');
            nameInput.addEventListener('input', async (e) => {
                variable.name = (e.target as HTMLInputElement).value;
                await this.plugin.saveSettings();
            });

            // Type select
            const typeSelect = wrapper.createEl('select', {
                cls: 'dropdown'
            });
            typeSelect.addClass('handwrite-settings__variable-type');
            ['string', 'array', 'number'].forEach(type => {
                const option = typeSelect.createEl('option', { text: type, value: type });
                if (type === variable.type) option.selected = true;
            });
            typeSelect.addEventListener('change', async (e) => {
                variable.type = (e.target as HTMLSelectElement).value as 'string' | 'array' | 'number';
                await this.plugin.saveSettings();
            });

            // Description input
            const descInput = wrapper.createEl('input', {
                type: 'text',
                value: variable.description,
                placeholder: 'e.g., "Look for a date in the top right corner"',
                cls: 'setting-text'
            });
            descInput.addClass('handwrite-settings__variable-description');
            descInput.addEventListener('input', async (e) => {
                variable.description = (e.target as HTMLInputElement).value;
                await this.plugin.saveSettings();
            });
        });
    }

}
