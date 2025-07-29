# Handwrite OCR for Obsidian

An Obsidian plugin that converts handwritten notes from images and PDFs into organized Markdown documents using Google's Gemini AI.

## Features

- **PDF & Image OCR**: Process PDF files and images (PNG, JPG, JPEG, WEBP, GIF) containing handwritten notes
- **Gemini AI Integration**: Uses Google's advanced Gemini models for accurate handwriting recognition
- **Batch Processing**: Process multiple files simultaneously with progress tracking
- **Custom Templates**: Fully customizable output templates for generated notes
- **Variable Extraction**: Extract custom variables like dates, authors, topics from your handwritten notes
- **Smart Organization**: Automatically organize processed notes into designated folders

## Setup

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key for use in the plugin settings

2. **Configure the Plugin**:
   - Go to Settings → Handwrite OCR
   - Paste your Gemini API key
   - Customize other settings as needed

## Usage

### Processing Files

#### Method 1: Ribbon Icon

Click the image icon in the left ribbon to open the file selector

#### Method 2: Context Menu

Right-click on any supported file or folder and select "Process with Handwrite OCR"

#### Method 3: Command Palette

- `Ctrl/Cmd + P` → "Process folder" (opens file selector)

### Configuration Options

#### OCR Settings

- **Gemini Model**: Choose between different Gemini models:
  - Gemini 2.0 Flash (Recommended - Fast)
  - Gemini 2.5 Flash (Latest - Thinking capabilities)
  - Gemini 2.5 Pro (Most Advanced)
  - Legacy models (1.5 Flash/Pro)
- **OCR Prompt**: Customize the prompt sent to Gemini for text extraction
- **Extractable Variables**: Define custom variables to extract from notes

#### Output Settings

- **Output Folder**: Where processed notes will be saved
- **Filename Template**: Customize output filenames using variables
- **Note Template**: Define the structure of generated notes

#### Processing Options

- **Concurrent Workers**: Number of files to process simultaneously
- **Show Progress Bar**: Toggle progress visualization
- **Debug Mode**: Enable detailed logging for troubleshooting

## Templates

### Filename Templates

Use variables to create dynamic filenames:

**Built-in variables:**

- `{{baseName}}` - Original filename without extension
- `{{extension}}` - Original file extension
- `{{originalFilename}}` - Full original filename
- `{{dateProcessed}}` - Processing timestamp
- `{{secondsBase36}}` - Unique identifier based on time

**Extracted variables:**

- Any variables extracted from your documents (defined in Extractable Variables settings)

Example: `{{date_composed}}_{{author}}_{{baseName}}.md`

### Note Templates

Customize the structure of generated notes:

**Built-in variables:**

- `{{content}}` - The transcribed text
- `{{tags}}` - Array of extracted tags
- `{{filename}}` - Name of the source file
- `{{relativeFilePath}}` - Relative path to source
- `{{absoluteFilePath}}` - Absolute path to source
- `{{dateProcessed}}` - When the file was processed
- `{{pageCount}}` - Number of pages processed
- `{{modelUsed}}` - Gemini model used
- Any variables extracted from your documents

Example template:
```markdown
---
attachments: 
  - '[[{{relativeFilePath}}]]'
dateCreated: {{dateProcessed}}
tags: {{tags}}
author: {{author}}
course: {{course}}
---

# {{title}}

{{content}}

---
*Processed from {{filename}} on {{dateProcessed}} using {{modelUsed}}*
```

### Extractable Variables

Define variables that Gemini will extract from your handwritten notes. These are dynamic values found within the document content:

```yaml
- name: "author"
  type: "string"
  description: "Person who wrote the notes"
  
- name: "topics"
  type: "array"
  description: "Main topics covered"
  
- name: "date_composed"
  type: "string"
  description: "Date when notes were written"
```

## Examples

### Meeting Notes

Configure variables to extract attendees, action items, and dates from meeting notes.

### Study Notes

Extract course names, topics, and key concepts from handwritten study materials.

### Journal Entries

Automatically tag emotions, events, and dates from personal journal pages.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

