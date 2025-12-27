import { ExtractableVariable } from '../gemini/client';

export interface HandwriteSettings {
    geminiApiKey: string;
    geminiModel: string;
    prompt: string;
    extractableVariables: ExtractableVariable[];
    templateContent: string;
    filenameTemplate: string;
    outputFolder: string;
    concurrentWorkers: number;
    showProgressBar: boolean;
    debugMode: boolean;
    moveFilesAfterProcessing: boolean;
    processedFilesFolder: string;
    defaultTags: string[];
    autoOpenCreatedNotes: boolean;
}

export const DEFAULT_SETTINGS: HandwriteSettings = {
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash-preview-05-20',
    prompt: `Extract the handwritten text from this image.
- Put the main text content in the "content" field, preserving ALL line breaks and formatting
- Use $ for LaTeX, not \`\`\`latex.
- Transcribe the text exactly as it appears, including newlines, spacing, and paragraph breaks.
- IMPORTANT: Preserve all line breaks and whitespace in the content field.`,
    extractableVariables: [
        {
            name: 'tags',
            type: 'array',
            description: 'Find any hashtags (words starting with #) and list them. If no hashtags are found, return an empty array.'
        }
    ],
    templateContent: `---
attachments: 
  - {{markdownLink}}
dateCreated: {{dateProcessed}}
tags: {{tags}}
dateModified: {{dateProcessed}}
---

# Handwritten Note

{{content}}`,
    filenameTemplate: '{{baseName}}.md',
    outputFolder: 'Handwritten Notes',
    concurrentWorkers: 4,
    showProgressBar: true,
    debugMode: false,
    moveFilesAfterProcessing: false,
    processedFilesFolder: 'Processed Handwritten Files',
    defaultTags: [],
    autoOpenCreatedNotes: false
};

export const EXAMPLE_EXTRACTABLE_VARIABLES: ExtractableVariable[] = [
    {
        name: 'tags',
        type: 'array',
        description: 'Find any hashtags (words starting with #) and list them. If no hashtags are found, return an empty array.'
    },
    {
        name: 'author',
        type: 'string',
        description: 'Look for any person\'s name mentioned in the notes'
    },
    {
        name: 'meeting_attendees',
        type: 'array',
        description: 'Extract all names of people mentioned as attendees'
    },
    {
        name: 'date_composed',
        type: 'string',
        description: 'Look for any date when these notes were written'
    },
    {
        name: 'course',
        type: 'string',
        description: 'Extract the course or subject name if mentioned'
    },
    {
        name: 'topics',
        type: 'array',
        description: 'List the main topics or concepts covered'
    },
    {
        name: 'priority_score',
        type: 'number',
        description: 'Rate the urgency/importance on a scale of 1-10 if mentioned'
    }
];