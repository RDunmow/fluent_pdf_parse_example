// Browser-compatible PDF parsing utility
import { PDFTextExtractor } from './browserPDFParser.js';

export class BrowserPDFParser {
    constructor() {
        this.isInitialized = false;
        this.textExtractor = new PDFTextExtractor();
    }

    /**
     * Parse PDF file and extract text content
     * @param {File|ArrayBuffer|Uint8Array} pdfData - The PDF file data
     * @returns {Promise<Object>} - Promise resolving to parsed PDF data
     */
    async parsePDF(pdfData) {
        console.log('Using browser-compatible PDF text extractor...');
        return await this.textExtractor.parsePDF(pdfData);
    }

    /**
     * Extract form fields and labels from PDF text using improved patterns
     * @param {string} text - The extracted text from PDF
     * @returns {Object} - Object containing detected form fields and labels
     */
    extractFormFields(text) {
        if (!text || typeof text !== 'string') {
            return {
                labels: [],
                formFields: [],
                textLength: 0
            };
        }

        const formFields = [];
        const labels = [];
        const uniqueLabels = new Set();
        const uniqueFields = new Set();
        
        // Enhanced regex patterns for better form detection
        const patterns = {
            // Patterns like "Name: ______" or "Name:___________"
            colonPattern: /([A-Za-z][A-Za-z\s]{2,30}):\s*[_\s-]{2,}|([A-Za-z][A-Za-z\s]{2,30}):\s*$/gm,
            
            // Patterns like "[ ] Option" or "[x] Option" for checkboxes
            checkboxPattern: /\[[\sx✓✗]\]\s*([A-Za-z][A-Za-z\s]{1,50})/g,
            
            // Patterns like "○ Option" or "● Option" for radio buttons
            radioPattern: /[○●◯●]\s*([A-Za-z][A-Za-z\s]{1,50})/g,
            
            // Patterns like "Name ________________"
            underlinePattern: /([A-Za-z][A-Za-z\s]{2,30})\s+[_-]{4,}/g,
            
            // Patterns like "1. Field Name" or "a) Field Name"
            numberedPattern: /(?:^\d+\.|\w+\))\s+([A-Za-z][A-Za-z\s]{2,50})/gm,
            
            // Common form labels
            commonLabels: /\b(Name|First\s+Name|Last\s+Name|Address|Phone|Email|Date|Signature|City|State|ZIP|SSN|DOB|Date\s+of\s+Birth|Gender|Age|Company|Title|Department|Employee\s+ID|Social\s+Security|Driver\s+License)\b(?:\s*:|\s+[_-]{2,})/gi
        };

        // Extract patterns with limits to prevent issues
        const extractPattern = (pattern, type, maxMatches = 50) => {
            let matchCount = 0;
            let match;
            pattern.lastIndex = 0; // Reset regex state
            
            while ((match = pattern.exec(text)) !== null && matchCount < maxMatches) {
                matchCount++;
                const label = match[1] || match[2];
                if (label && label.trim().length > 2) {
                    const cleanLabel = label.trim();
                    
                    if (type === 'label') {
                        if (!uniqueLabels.has(cleanLabel.toLowerCase())) {
                            uniqueLabels.add(cleanLabel.toLowerCase());
                            labels.push(cleanLabel);
                        }
                    } else {
                        const fieldId = `${type}_${cleanLabel.toLowerCase().replace(/\s+/g, '_')}`;
                        if (!uniqueFields.has(fieldId)) {
                            uniqueFields.add(fieldId);
                            formFields.push({
                                type: type,
                                label: cleanLabel,
                                id: fieldId
                            });
                        }
                    }
                }
                
                // Prevent infinite loops
                if (match.index === pattern.lastIndex) {
                    pattern.lastIndex++;
                }
            }
        };
        
        // Extract different types of patterns
        extractPattern(patterns.colonPattern, 'label');
        extractPattern(patterns.checkboxPattern, 'checkbox');
        extractPattern(patterns.radioPattern, 'radio');
        extractPattern(patterns.underlinePattern, 'text');
        extractPattern(patterns.numberedPattern, 'numbered');
        extractPattern(patterns.commonLabels, 'label');

        return {
            labels: labels,
            formFields: formFields,
            textLength: text.length,
            uniqueFieldCount: uniqueFields.size,
            uniqueLabelCount: uniqueLabels.size
        };
    }

    /**
     * Extract structured data from PDF with confidence scoring
     * @param {string} text - The extracted text from PDF
     * @returns {Object} - Structured form data with confidence scores
     */
    extractStructuredData(text) {
        if (!text) return { confidence: 0, data: {} };

        const formData = this.extractFormFields(text);
        let confidence = 0;

        // Calculate confidence based on detected patterns
        if (formData.labels.length > 0) confidence += 30;
        if (formData.formFields.length > 0) confidence += 40;
        if (text.includes('Form') || text.includes('Application')) confidence += 10;
        if (text.includes('Date') || text.includes('Signature')) confidence += 20;

        // Additional confidence boosts for common form indicators
        const checkboxCount = (text.match(/\[[\s\x]\]/g) || []).length;
        const underlineCount = (text.match(/_{4,}/g) || []).length;
        const commonFieldCount = (text.match(/Name.*:|Address.*:|Phone.*:/gi) || []).length;
        
        if (checkboxCount > 0) confidence += Math.min(checkboxCount * 3, 15);
        if (underlineCount > 0) confidence += Math.min(underlineCount * 2, 10);
        if (commonFieldCount > 0) confidence += Math.min(commonFieldCount * 5, 15);

        confidence = Math.min(confidence, 100);

        return {
            confidence: confidence,
            isForm: confidence > 50,
            data: formData,
            summary: {
                totalLabels: formData.labels.length,
                totalFields: formData.formFields.length,
                textLength: formData.textLength,
                hasCheckboxes: formData.formFields.some(field => field.type === 'checkbox'),
                hasTextFields: formData.formFields.some(field => field.type === 'text'),
                hasRadioButtons: formData.formFields.some(field => field.type === 'radio')
            }
        };
    }

    /**
     * Complete PDF processing: parse and extract form data with enhanced analysis
     * @param {File|ArrayBuffer|Uint8Array} pdfData - The PDF file data
     * @returns {Promise<Object>} - Promise resolving to complete analysis
     */
    async processFormPDF(pdfData) {
        try {
            console.log('Processing PDF with pdf-parse library...');
            const parseResult = await this.parsePDF(pdfData);
            
            if (!parseResult.success) {
                return parseResult;
            }
            
            const structuredData = this.extractStructuredData(parseResult.text);
            
            return {
                success: true,
                pdfInfo: {
                    pages: parseResult.numPages,
                    info: parseResult.info,
                    metadata: parseResult.metadata,
                    version: parseResult.version
                },
                text: parseResult.text,
                pageTexts: parseResult.pageTexts,
                formAnalysis: structuredData.data,
                confidence: structuredData.confidence,
                isForm: structuredData.isForm,
                summary: structuredData.summary
            };
            
        } catch (error) {
            console.error('PDF processing error:', error);
            return {
                success: false,
                error: error.message || 'PDF processing failed'
            };
        }
    }

    /**
     * Validate if the file is a valid PDF
     * @param {File} file - The file to validate
     * @returns {boolean} - True if file appears to be PDF
     */
    static isPDF(file) {
        return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    }

    /**
     * Get file size in human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size string
     */
    static formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
}