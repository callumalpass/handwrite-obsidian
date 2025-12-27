import { GoogleGenAI } from '@google/genai';

export interface ExtractableVariable {
    name: string;
    type: 'string' | 'array' | 'number';
    description: string;
}

export interface StructuredResponse {
    content: string;
    extractedVariables: Record<string, any>;
}

export class GeminiClient {
    private ai: GoogleGenAI;
    private modelName: string;
    private debugMode: boolean;

    constructor(apiKey: string, modelName: string = 'gemini-2.5-flash-preview-05-20', debugMode: boolean = false) {
        this.ai = new GoogleGenAI({ apiKey });
        this.modelName = modelName;
        this.debugMode = debugMode;
    }

    private buildPrompt(basePrompt: string, extractableVars: ExtractableVariable[]): string {
        let prompt = basePrompt;
        
        if (extractableVars.length > 0) {
            prompt += '\n\nAdditionally, extract the following variables:\n';
            for (const variable of extractableVars) {
                prompt += `- ${variable.name} (${variable.type}): ${variable.description}\n`;
            }
        }
        
        // Always request JSON format
        prompt += '\n\nReturn the response in valid JSON format with the following structure:\n';
        prompt += '{\n';
        prompt += '  "content": "the transcribed text"';
        
        if (extractableVars.length > 0) {
            prompt += ',\n';
            for (let i = 0; i < extractableVars.length; i++) {
                const variable = extractableVars[i];
                const example = variable.type === 'array' ? '[]' : variable.type === 'number' ? '0' : '""';
                prompt += `  "${variable.name}": ${example}`;
                if (i < extractableVars.length - 1) {
                    prompt += ',\n';
                }
            }
        }
        
        prompt += '\n}';
        
        return prompt;
    }

    private parseJSONResponse(text: string | undefined): any {
        if (!text) {
            throw new Error('No response text received');
        }
        
        let jsonStr = text;
        
        // Try to extract JSON from markdown code blocks
        if (text.includes('```json')) {
            const start = text.indexOf('```json') + 7;
            const end = text.indexOf('```', start);
            if (end > 0) {
                jsonStr = text.substring(start, end).trim();
            }
        } else if (text.includes('```')) {
            const start = text.indexOf('```') + 3;
            const end = text.indexOf('```', start);
            if (end > 0) {
                jsonStr = text.substring(start, end).trim();
            }
        }

        // Try to find JSON by looking for opening brace
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
        }

        return JSON.parse(jsonStr);
    }

    async extractStructuredTextFromImage(
        imageData: Uint8Array,
        mimeType: string,
        prompt: string,
        extractableVars: ExtractableVariable[]
    ): Promise<StructuredResponse> {
        const finalPrompt = this.buildPrompt(prompt, extractableVars);

        try {
            const result = await this.ai.models.generateContent({
                model: this.modelName,
                contents: [
                    {
                        parts: [
                            { text: finalPrompt },
                            {
                                inlineData: {
                                    mimeType,
                                    data: Buffer.from(imageData).toString('base64')
                                }
                            }
                        ]
                    }
                ]
            });
            
            const text = result.text;
            const parsed = this.parseJSONResponse(text);
            
            const structuredResponse: StructuredResponse = {
                content: parsed.content || '',
                extractedVariables: {}
            };

            // Extract all variables
            for (const variable of extractableVars) {
                if (variable.name in parsed) {
                    structuredResponse.extractedVariables[variable.name] = parsed[variable.name];
                }
            }

            return structuredResponse;
        } catch (error) {
            if (this.debugMode) {
                console.error('Failed to process image:', error);
            }
            throw new Error(`Failed to process image: ${error}`);
        }
    }

    async extractStructuredTextFromPDF(
        pdfData: Uint8Array,
        prompt: string,
        extractableVars: ExtractableVariable[]
    ): Promise<StructuredResponse> {
        const finalPrompt = this.buildPrompt(prompt, extractableVars);

        try {
            const result = await this.ai.models.generateContent({
                model: this.modelName,
                contents: [
                    {
                        parts: [
                            { text: finalPrompt },
                            {
                                inlineData: {
                                    mimeType: 'application/pdf',
                                    data: Buffer.from(pdfData).toString('base64')
                                }
                            }
                        ]
                    }
                ]
            });
            
            const text = result.text;
            const parsed = this.parseJSONResponse(text);
            
            const structuredResponse: StructuredResponse = {
                content: parsed.content || '',
                extractedVariables: {}
            };

            // Extract all variables
            for (const variable of extractableVars) {
                if (variable.name in parsed) {
                    structuredResponse.extractedVariables[variable.name] = parsed[variable.name];
                }
            }

            return structuredResponse;
        } catch (error) {
            if (this.debugMode) {
                console.error('Failed to process PDF:', error);
            }
            throw new Error(`Failed to process PDF: ${error}`);
        }
    }
}