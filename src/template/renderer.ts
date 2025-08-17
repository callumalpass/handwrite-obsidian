export interface TemplateData {
    content: string;
    tags: string[];
    filename: string;
    absoluteFilePath: string;
    relativeFilePath: string;
    markdownLink: string;
    dateProcessed: string;
    pageCount: number;
    modelUsed: string;
    customVariables: Record<string, any>;
}

export interface FilenameData {
    baseName: string;
    extension: string;
    originalFilename: string;
    dateProcessed: string;
    secondsBase36: string;
    [key: string]: any; // For custom variables
}

export class TemplateRenderer {
    static renderTemplate(template: string, data: TemplateData): string {
        // Create a copy of the data with escaped content
        const escapedData = {
            ...data,
            content: data.content.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}')
        };

        // Simple template replacement
        let result = template;
        
        // Replace simple variables
        for (const [key, value] of Object.entries(escapedData)) {
            if (typeof value === 'string' || typeof value === 'number') {
                const regex = new RegExp(`\\{\\{\\s*\\.?${key}\\s*\\}\\}`, 'g');
                result = result.replace(regex, String(value));
            }
        }

        // Replace custom variables
        for (const [key, value] of Object.entries(data.customVariables)) {
            const regex = new RegExp(`\\{\\{\\s*\\.?customVariables\\.${key}\\s*\\}\\}`, 'g');
            result = result.replace(regex, String(value));
            // Also allow direct access without customVariables prefix
            const directRegex = new RegExp(`\\{\\{\\s*\\.?${key}\\s*\\}\\}`, 'g');
            result = result.replace(directRegex, String(value));
        }

        // Handle array values (like tags)
        // Check both data.tags and customVariables.tags for backward compatibility
        const tags = data.tags || data.customVariables.tags;
        if (tags && Array.isArray(tags) && tags.length > 0) {
            const tagsRegex = /\{\{\s*\.?tags\s*\}\}/g;
            const tagsYaml = tags.map(tag => `  - ${tag}`).join('\n');
            result = result.replace(tagsRegex, `\n${tagsYaml}`);
        } else {
            result = result.replace(/tags:\s*\{\{\s*\.?tags\s*\}\}/g, 'tags: []');
        }
        
        // Handle other array values in customVariables for YAML formatting
        for (const [key, value] of Object.entries(data.customVariables)) {
            if (Array.isArray(value) && key !== 'tags') { // tags already handled above
                const arrayRegex = new RegExp(`(\\w+):\\s*\\{\\{\\s*\\.?${key}\\s*\\}\\}`, 'g');
                if (value.length > 0) {
                    const yamlArray = value.map(item => `  - ${item}`).join('\n');
                    result = result.replace(arrayRegex, `$1:\n${yamlArray}`);
                } else {
                    result = result.replace(arrayRegex, '$1: []');
                }
            }
        }

        return result;
    }

    static generateFilename(template: string, originalFilename: string, customVars: Record<string, any>): string {
        const baseName = originalFilename.replace(/\.[^.]+$/, '');
        const extension = originalFilename.match(/\.[^.]+$/)?.[0] || '';
        
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const secondsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / 1000);
        const secondsBase36 = secondsSinceMidnight.toString(36);

        const data: FilenameData = {
            baseName,
            extension,
            originalFilename,
            dateProcessed: now.toISOString(),
            secondsBase36,
            ...customVars
        };

        let result = template;
        
        // Replace all variables
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`\\{\\{\\s*\\.?${key}\\s*\\}\\}`, 'g');
            result = result.replace(regex, String(value));
        }

        return result;
    }

    static createTemplateData(
        content: string,
        tags: string[],
        filename: string,
        filePath: string,
        markdownLink: string,
        pageCount: number,
        modelUsed: string,
        customVars: Record<string, any>,
        extractedVars: Record<string, any>
    ): TemplateData {
        // Merge custom variables with extracted variables
        const mergedVars = { ...customVars, ...extractedVars };

        return {
            content,
            tags,
            filename,
            absoluteFilePath: filePath,
            relativeFilePath: filePath,
            markdownLink,
            dateProcessed: new Date().toISOString(),
            pageCount,
            modelUsed,
            customVariables: mergedVars
        };
    }
}

export const DEFAULT_TEMPLATE = `---
attachments: 
  - {{markdownLink}}
dateCreated: {{dateProcessed}}
tags: {{tags}}
dateModified: {{dateProcessed}}
---

# Handwritten Note

{{content}}`;