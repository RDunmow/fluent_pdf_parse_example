// Simple PDF text extraction without external dependencies
// This is a basic PDF parser that works for simple text-based PDFs

export class SimplePDFParser {
    constructor() {
        this.name = 'SimplePDFParser';
    }

    /**
     * Parse PDF file and extract text content using basic text extraction
     * @param {File|ArrayBuffer|Uint8Array} pdfData - The PDF file data
     * @returns {Promise<Object>} - Promise resolving to parsed PDF data
     */
    async parsePDF(pdfData) {
        try {
            let uint8Array;
            
            // Convert input to Uint8Array
            if (pdfData instanceof File) {
                const arrayBuffer = await pdfData.arrayBuffer();
                uint8Array = new Uint8Array(arrayBuffer);
            } else if (pdfData instanceof ArrayBuffer) {
                uint8Array = new Uint8Array(pdfData);
            } else if (pdfData instanceof Uint8Array) {
                uint8Array = pdfData;
            } else {
                throw new Error('Unsupported PDF data format');
            }

            // Basic PDF validation
            if (!this.isPDFFile(uint8Array)) {
                throw new Error('Invalid PDF file format');
            }

            // Extract text using simple pattern matching
            const extractedText = this.extractTextFromPDF(uint8Array);
            const pageCount = this.estimatePageCount(uint8Array);
            
            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No readable text found in PDF. The PDF may contain only images or be encrypted.');
            }

            return {
                success: true,
                text: extractedText.trim(),
                pageTexts: [extractedText.trim()], // Simple parser treats as single page
                numPages: pageCount,
                info: { 
                    parser: 'SimplePDFParser',
                    method: 'basic_text_extraction'
                },
                metadata: {},
                fingerprints: []
            };
            
        } catch (error) {
            console.error('Simple PDF parsing error:', error);
            return {
                success: false,
                error: error.message || 'PDF parsing failed with simple parser'
            };
        }
    }

    /**
     * Check if the file is a valid PDF
     * @param {Uint8Array} data - PDF file data
     * @returns {boolean} - True if appears to be a PDF file
     */
    isPDFFile(data) {
        // Check for PDF header
        const header = String.fromCharCode(...data.slice(0, 8));
        return header.startsWith('%PDF-');
    }

    /**
     * Extract readable text from PDF binary data
     * @param {Uint8Array} data - PDF file data
     * @returns {string} - Extracted text
     */
    extractTextFromPDF(data) {
        let text = '';
        
        try {
            // Convert to string, but limit size to prevent stack overflow
            const maxSize = Math.min(data.length, 1024 * 1024); // Max 1MB for text extraction
            const limitedData = data.slice(0, maxSize);
            const dataStr = String.fromCharCode(...limitedData);
            
            // Look for text between common PDF text markers
            const textPatterns = [
                // Text in parentheses (most common in PDFs) - non-greedy
                /\(([^)]{1,200})\)/g,
                // Text in brackets - non-greedy  
                /\[([^\]]{1,200})\]/g,
                // Text between BT and ET operators - non-greedy
                /BT\s*([\s\S]{1,500}?)\s*ET/g,
            ];

            // Extract text using each pattern with limits
            textPatterns.forEach(pattern => {
                let matchCount = 0;
                const maxMatches = 1000; // Prevent infinite loops
                let match;
                
                // Reset regex state
                pattern.lastIndex = 0;
                
                while ((match = pattern.exec(dataStr)) !== null && matchCount < maxMatches) {
                    matchCount++;
                    const matchedText = match[1];
                    if (matchedText && this.isReadableText(matchedText)) {
                        text += this.cleanPDFText(matchedText) + ' ';
                    }
                    
                    // Prevent infinite loops on zero-width matches
                    if (match.index === pattern.lastIndex) {
                        pattern.lastIndex++;
                    }
                }
            });

            // If no text found with patterns, try extracting readable sequences
            if (text.trim().length < 10) {
                text = this.extractReadableSequences(dataStr);
            }

        } catch (error) {
            console.error('Error in extractTextFromPDF:', error);
            // Return empty string rather than crash
            text = '';
        }

        return this.postProcessText(text);
    }

    /**
     * Check if text appears to be readable content
     * @param {string} text - Text to check
     * @returns {boolean} - True if text appears readable
     */
    isReadableText(text) {
        if (!text || text.length < 2) return false;
        
        // Check for reasonable character distribution
        const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
        const totalLength = text.length;
        const alphaRatio = alphaCount / totalLength;
        
        // Must have some alphabetic characters and not be too much noise
        return alphaRatio > 0.3 && totalLength > 1;
    }

    /**
     * Clean PDF text by removing PDF-specific escape sequences
     * @param {string} text - Raw text from PDF
     * @returns {string} - Cleaned text
     */
    cleanPDFText(text) {
        return text
            .replace(/\\n/g, '\n')          // Handle newlines
            .replace(/\\r/g, '\r')          // Handle carriage returns
            .replace(/\\t/g, '\t')          // Handle tabs
            .replace(/\\\(/g, '(')          // Handle escaped parentheses
            .replace(/\\\)/g, ')')          // Handle escaped parentheses
            .replace(/\\\\/g, '\\')         // Handle escaped backslashes
            .replace(/\\(\d{3})/g, (match, octal) => {
                // Convert octal character codes
                return String.fromCharCode(parseInt(octal, 8));
            });
    }

    /**
     * Extract readable text sequences from PDF content
     * @param {string} content - PDF content as string
     * @returns {string} - Extracted readable text
     */
    extractReadableSequences(content) {
        const sequences = [];
        
        try {
            // Limit content size to prevent stack overflow
            const maxContentSize = Math.min(content.length, 100000); // Max 100KB
            const limitedContent = content.substring(0, maxContentSize);
            
            const readablePattern = /[A-Za-z0-9\s.,!?;:'"()-]{4,100}/g;
            let matchCount = 0;
            const maxMatches = 500; // Limit matches
            let match;
            
            while ((match = readablePattern.exec(limitedContent)) !== null && matchCount < maxMatches) {
                matchCount++;
                const sequence = match[0].trim();
                if (this.isReadableText(sequence) && sequence.length > 3 && sequence.length < 200) {
                    sequences.push(sequence);
                }
                
                // Prevent infinite loops
                if (match.index === readablePattern.lastIndex) {
                    readablePattern.lastIndex++;
                }
            }
            
        } catch (error) {
            console.error('Error in extractReadableSequences:', error);
            return '';
        }
        
        return sequences.slice(0, 100).join(' '); // Limit final output
    }

    /**
     * Post-process extracted text to improve readability
     * @param {string} text - Raw extracted text
     * @returns {string} - Processed text
     */
    postProcessText(text) {
        return text
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/([.!?])\s*([A-Z])/g, '$1 $2')  // Fix sentence spacing
            .replace(/([a-z])([A-Z])/g, '$1 $2')     // Add spaces between words
            .trim();
    }

    /**
     * Estimate the number of pages in the PDF
     * @param {Uint8Array} data - PDF file data
     * @returns {number} - Estimated page count
     */
    estimatePageCount(data) {
        const dataStr = String.fromCharCode(...data);
        
        // Look for page objects in PDF structure
        const pageMatches = dataStr.match(/\/Type\s*\/Page[^s]/g);
        if (pageMatches) {
            return pageMatches.length;
        }
        
        // Fallback: look for page references
        const pageRefMatches = dataStr.match(/\d+\s+\d+\s+obj.*?\/Type\s*\/Page/g);
        if (pageRefMatches) {
            return pageRefMatches.length;
        }
        
        // Default assumption
        return 1;
    }

    /**
     * Extract form fields and labels using the same logic as the main parser
     * @param {string} text - Extracted text
     * @returns {Object} - Form field analysis
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
            colonPattern: /([A-Za-z][A-Za-z\s]{2,30}):\s*[_\s-]{2,}|([A-Za-z][A-Za-z\s]{2,30}):\s*$/gm,
            checkboxPattern: /\[[\sx✓✗]\]\s*([A-Za-z][A-Za-z\s]{1,50})/g,
            radioPattern: /[○●◯●]\s*([A-Za-z][A-Za-z\s]{1,50})/g,
            underlinePattern: /([A-Za-z][A-Za-z\s]{2,30})\s+[_-]{4,}/g,
            numberedPattern: /(?:^\d+\.|\w+\))\s+([A-Za-z][A-Za-z\s]{2,50})/gm,
            commonLabels: /\b(Name|First\s+Name|Last\s+Name|Address|Phone|Email|Date|Signature|City|State|ZIP|SSN|DOB|Date\s+of\s+Birth|Gender|Age|Company|Title|Department|Employee\s+ID|Social\s+Security|Driver\s+License)\b(?:\s*:|\s+[_-]{2,})/gi
        };

        let matches;
        
        // Extract colon-separated labels
        while ((matches = patterns.colonPattern.exec(text)) !== null) {
            const label = matches[1] || matches[2];
            if (label && label.trim().length > 2) {
                const cleanLabel = label.trim();
                if (!uniqueLabels.has(cleanLabel.toLowerCase())) {
                    uniqueLabels.add(cleanLabel.toLowerCase());
                    labels.push(cleanLabel);
                }
            }
        }
        
        // Extract checkbox options
        while ((matches = patterns.checkboxPattern.exec(text)) !== null) {
            const fieldId = 'checkbox_' + matches[1].trim().toLowerCase().replace(/\s+/g, '_');
            if (!uniqueFields.has(fieldId)) {
                uniqueFields.add(fieldId);
                formFields.push({
                    type: 'checkbox',
                    label: matches[1].trim(),
                    id: fieldId
                });
            }
        }
        
        // Extract other field types...
        // (Similar to the main parser)

        return {
            labels: labels,
            formFields: formFields,
            textLength: text.length,
            uniqueFieldCount: uniqueFields.size,
            uniqueLabelCount: uniqueLabels.size
        };
    }

    /**
     * Extract structured data with confidence scoring
     * @param {string} text - Extracted text
     * @returns {Object} - Structured form data
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
     * Complete PDF processing with form analysis
     * @param {File|ArrayBuffer|Uint8Array} pdfData - PDF data
     * @returns {Promise<Object>} - Complete analysis results
     */
    async processFormPDF(pdfData) {
        try {
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
                    metadata: parseResult.metadata
                },
                text: parseResult.text,
                pageTexts: parseResult.pageTexts,
                formAnalysis: structuredData.data,
                confidence: structuredData.confidence,
                isForm: structuredData.isForm,
                summary: structuredData.summary
            };
            
        } catch (error) {
            console.error('Simple PDF processing error:', error);
            return {
                success: false,
                error: error.message || 'PDF processing failed'
            };
        }
    }

    /**
     * Static method to check if file is PDF
     * @param {File} file - File to check
     * @returns {boolean} - True if PDF
     */
    static isPDF(file) {
        return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    }
}