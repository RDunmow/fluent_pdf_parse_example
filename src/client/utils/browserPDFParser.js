// Browser-compatible PDF text extraction
// This implementation focuses on extracting readable text from PDFs without Node.js dependencies

export class PDFTextExtractor {
    constructor() {
        this.name = 'PDFTextExtractor';
    }

    /**
     * Parse PDF and extract text content
     * @param {File|ArrayBuffer|Uint8Array} pdfData - The PDF file data
     * @returns {Promise<Object>} - Promise resolving to parsed PDF data
     */
    async parsePDF(pdfData) {
        try {
            // Convert input to Uint8Array for processing
            let uint8Array;
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

            // Validate PDF format
            if (!this.validatePDF(uint8Array)) {
                throw new Error('Invalid PDF file format');
            }

            // Extract text using multiple methods
            const extractedText = await this.extractTextContent(uint8Array);
            const pageCount = this.estimatePageCount(uint8Array);
            const metadata = this.extractBasicMetadata(uint8Array);

            if (!extractedText || extractedText.trim().length === 0) {
                return {
                    success: false,
                    error: 'No readable text found in PDF. The PDF may contain only images, be encrypted, or use unsupported encoding.'
                };
            }

            return {
                success: true,
                text: extractedText.trim(),
                pageTexts: [extractedText.trim()], // Treat as single text block
                numPages: pageCount,
                info: metadata,
                metadata: {},
                version: metadata.version || ''
            };

        } catch (error) {
            console.error('PDF parsing error:', error);
            return {
                success: false,
                error: error.message || 'PDF parsing failed'
            };
        }
    }

    /**
     * Validate that the data is a PDF file
     * @param {Uint8Array} data - PDF data
     * @returns {boolean} - True if valid PDF
     */
    validatePDF(data) {
        if (!data || data.length < 8) return false;
        
        // Check PDF header
        const header = new TextDecoder('ascii', { fatal: false }).decode(data.slice(0, 8));
        return header.startsWith('%PDF-');
    }

    /**
     * Extract text content from PDF data
     * @param {Uint8Array} data - PDF data
     * @returns {Promise<string>} - Extracted text
     */
    async extractTextContent(data) {
        try {
            // Convert binary data to string for pattern matching
            const pdfString = this.binaryToString(data);
            
            let extractedText = '';
            
            // Method 1: Extract text from stream objects
            extractedText += this.extractFromStreams(pdfString);
            
            // Method 2: Extract text from parentheses (most common)
            extractedText += this.extractFromParentheses(pdfString);
            
            // Method 3: Extract text from brackets
            extractedText += this.extractFromBrackets(pdfString);
            
            // Method 4: Extract from text showing operators
            extractedText += this.extractFromTextOperators(pdfString);
            
            // Clean and normalize the extracted text
            return this.cleanExtractedText(extractedText);
            
        } catch (error) {
            console.error('Text extraction error:', error);
            return '';
        }
    }

    /**
     * Convert binary data to string safely
     * @param {Uint8Array} data - Binary data
     * @returns {string} - String representation
     */
    binaryToString(data) {
        let result = '';
        const chunkSize = 8192; // Process in chunks to avoid call stack issues
        
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            result += String.fromCharCode(...chunk);
        }
        
        return result;
    }

    /**
     * Extract text from PDF stream objects
     * @param {string} pdfString - PDF content as string
     * @returns {string} - Extracted text
     */
    extractFromStreams(pdfString) {
        let text = '';
        
        // Look for stream objects containing text
        const streamPattern = /stream\s*([\s\S]*?)\s*endstream/g;
        let match;
        let matchCount = 0;
        
        while ((match = streamPattern.exec(pdfString)) !== null && matchCount < 100) {
            matchCount++;
            const streamContent = match[1];
            
            // Extract readable text from stream
            text += this.extractReadableFromStream(streamContent);
        }
        
        return text;
    }

    /**
     * Extract readable text from stream content
     * @param {string} streamContent - Stream content
     * @returns {string} - Readable text
     */
    extractReadableFromStream(streamContent) {
        let text = '';
        
        // Look for text showing operators
        const tjPattern = /\((.*?)\)\s*Tj/g;
        const tjArrayPattern = /\[(.*?)\]\s*TJ/g;
        
        let match;
        
        // Extract from Tj operators
        while ((match = tjPattern.exec(streamContent)) !== null) {
            const textContent = match[1];
            if (this.isReadableText(textContent)) {
                text += this.decodePDFText(textContent) + ' ';
            }
        }
        
        // Extract from TJ operators (array format)
        while ((match = tjArrayPattern.exec(streamContent)) !== null) {
            const arrayContent = match[1];
            const textParts = arrayContent.match(/\((.*?)\)/g);
            if (textParts) {
                textParts.forEach(part => {
                    const cleanText = part.replace(/[()]/g, '');
                    if (this.isReadableText(cleanText)) {
                        text += this.decodePDFText(cleanText) + ' ';
                    }
                });
            }
        }
        
        return text;
    }

    /**
     * Extract text from parentheses
     * @param {string} pdfString - PDF content
     * @returns {string} - Extracted text
     */
    extractFromParentheses(pdfString) {
        let text = '';
        const pattern = /\(([^)]{1,200})\)/g;
        let match;
        let matchCount = 0;
        
        while ((match = pattern.exec(pdfString)) !== null && matchCount < 500) {
            matchCount++;
            const textContent = match[1];
            if (this.isReadableText(textContent)) {
                text += this.decodePDFText(textContent) + ' ';
            }
        }
        
        return text;
    }

    /**
     * Extract text from brackets
     * @param {string} pdfString - PDF content
     * @returns {string} - Extracted text
     */
    extractFromBrackets(pdfString) {
        let text = '';
        const pattern = /\[([^\]]{1,200})\]/g;
        let match;
        let matchCount = 0;
        
        while ((match = pattern.exec(pdfString)) !== null && matchCount < 200) {
            matchCount++;
            const content = match[1];
            
            // Extract text from bracket arrays
            const textParts = content.match(/\(([^)]*)\)/g);
            if (textParts) {
                textParts.forEach(part => {
                    const cleanText = part.replace(/[()]/g, '');
                    if (this.isReadableText(cleanText)) {
                        text += this.decodePDFText(cleanText) + ' ';
                    }
                });
            }
        }
        
        return text;
    }

    /**
     * Extract text from text showing operators
     * @param {string} pdfString - PDF content
     * @returns {string} - Extracted text
     */
    extractFromTextOperators(pdfString) {
        let text = '';
        
        // Look for BT...ET blocks (text objects)
        const textObjectPattern = /BT\s*([\s\S]{1,1000}?)\s*ET/g;
        let match;
        let matchCount = 0;
        
        while ((match = textObjectPattern.exec(pdfString)) !== null && matchCount < 100) {
            matchCount++;
            const textObject = match[1];
            
            // Extract text from within the text object
            text += this.extractFromParentheses(textObject);
        }
        
        return text;
    }

    /**
     * Check if text appears to be readable
     * @param {string} text - Text to check
     * @returns {boolean} - True if readable
     */
    isReadableText(text) {
        if (!text || text.length < 1) return false;
        
        // Check for reasonable character content
        const printableChars = text.match(/[\w\s.,!?;:'"()-]/g);
        const printableRatio = printableChars ? printableChars.length / text.length : 0;
        
        return printableRatio > 0.5 && text.length > 0;
    }

    /**
     * Decode PDF text escapes and encoding
     * @param {string} text - Raw PDF text
     * @returns {string} - Decoded text
     */
    decodePDFText(text) {
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\')
            .replace(/\\(\d{3})/g, (match, octal) => {
                try {
                    return String.fromCharCode(parseInt(octal, 8));
                } catch {
                    return match;
                }
            });
    }

    /**
     * Clean and normalize extracted text
     * @param {string} text - Raw extracted text
     * @returns {string} - Cleaned text
     */
    cleanExtractedText(text) {
        return text
            .replace(/\s+/g, ' ')                    // Normalize whitespace
            .replace(/([.!?])\s*([A-Z])/g, '$1 $2')  // Fix sentence spacing
            .replace(/([a-z])([A-Z])/g, '$1 $2')     // Add spaces between words
            .trim();
    }

    /**
     * Estimate page count from PDF structure
     * @param {Uint8Array} data - PDF data
     * @returns {number} - Estimated page count
     */
    estimatePageCount(data) {
        try {
            const pdfString = this.binaryToString(data.slice(0, Math.min(data.length, 50000))); // Check first 50KB
            
            // Look for page objects
            const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
            if (pageMatches && pageMatches.length > 0) {
                return pageMatches.length;
            }
            
            // Fallback: look for page references
            const pageRefMatches = pdfString.match(/\d+\s+\d+\s+obj.*?\/Type\s*\/Page/g);
            if (pageRefMatches && pageRefMatches.length > 0) {
                return pageRefMatches.length;
            }
            
            return 1; // Default
        } catch {
            return 1;
        }
    }

    /**
     * Extract basic metadata from PDF
     * @param {Uint8Array} data - PDF data
     * @returns {Object} - Basic metadata
     */
    extractBasicMetadata(data) {
        try {
            const headerString = new TextDecoder('ascii', { fatal: false }).decode(data.slice(0, 100));
            const versionMatch = headerString.match(/%PDF-(\d+\.\d+)/);
            
            return {
                version: versionMatch ? versionMatch[1] : '',
                parser: 'PDFTextExtractor'
            };
        } catch {
            return { parser: 'PDFTextExtractor' };
        }
    }
}