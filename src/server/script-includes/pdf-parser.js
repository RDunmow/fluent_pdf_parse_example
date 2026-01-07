// Import the pdf-parse library
const pdf = require('pdf-parse');

var PDFParser = function() {
    this.initialize();
};

PDFParser.prototype = {
    initialize: function() {},

    /**
     * Parse PDF buffer and extract text content
     * @param {Buffer} pdfBuffer - The PDF file as a buffer
     * @param {Object} options - Optional parsing options
     * @returns {Promise} - Promise resolving to parsed PDF data
     */
    parsePDF: function(pdfBuffer, options) {
        var parseOptions = options || {};
        
        try {
            return pdf(pdfBuffer, parseOptions).then(function(data) {
                return {
                    success: true,
                    text: data.text,
                    numpages: data.numpages,
                    numrender: data.numrender,
                    info: data.info,
                    metadata: data.metadata || {},
                    version: data.version
                };
            }).catch(function(error) {
                return {
                    success: false,
                    error: error.message || 'Unknown PDF parsing error'
                };
            });
        } catch (e) {
            // Return a resolved promise with error for consistency
            return Promise.resolve({
                success: false,
                error: e.message || 'PDF parsing exception'
            });
        }
    },

    /**
     * Parse PDF with custom render options
     * @param {Buffer} pdfBuffer - The PDF file as a buffer
     * @param {Function} renderPage - Custom page rendering function
     * @returns {Promise} - Promise resolving to parsed PDF data
     */
    parsePDFWithCustomRender: function(pdfBuffer, renderPage) {
        var options = {};
        
        if (renderPage && typeof renderPage === 'function') {
            options.render_page = renderPage;
        }
        
        return this.parsePDF(pdfBuffer, options);
    },

    /**
     * Extract form fields and labels from PDF text using improved patterns
     * @param {string} text - The extracted text from PDF
     * @returns {Object} - Object containing detected form fields and labels
     */
    extractFormFields: function(text) {
        if (!text || typeof text !== 'string') {
            return {
                labels: [],
                formFields: [],
                textLength: 0
            };
        }

        var formFields = [];
        var labels = [];
        var uniqueLabels = new Set();
        var uniqueFields = new Set();
        
        // Enhanced regex patterns for better form detection
        var patterns = {
            // Patterns like "Name: ______" or "Name:___________"
            colonPattern: /([A-Za-z][A-Za-z\s]{2,30}):\s*[_\s-]{2,}|([A-Za-z][A-Za-z\s]{2,30}):\s*$/gm,
            
            // Patterns like "[ ] Option" or "[x] Option" for checkboxes
            checkboxPattern: /\[[\sx]\]\s*([A-Za-z][A-Za-z\s]{1,50})/g,
            
            // Patterns like "○ Option" or "● Option" for radio buttons
            radioPattern: /[○●]\s*([A-Za-z][A-Za-z\s]{1,50})/g,
            
            // Patterns like "Name ________________"
            underlinePattern: /([A-Za-z][A-Za-z\s]{2,30})\s+[_-]{4,}/g,
            
            // Patterns like "1. Field Name" or "a) Field Name"
            numberedPattern: /(?:^\d+\.|\w+\))\s+([A-Za-z][A-Za-z\s]{2,50})/gm,
            
            // Common form labels
            commonLabels: /\b(Name|Address|Phone|Email|Date|Signature|City|State|ZIP|SSN|DOB|Gender|Age|Company|Title|Department)\b(?:\s*:|\s+[_-]{2,})/gi
        };

        var matches;
        
        // Extract colon-separated labels
        while ((matches = patterns.colonPattern.exec(text)) !== null) {
            var label = matches[1] || matches[2];
            if (label && label.trim().length > 2) {
                var cleanLabel = label.trim();
                if (!uniqueLabels.has(cleanLabel.toLowerCase())) {
                    uniqueLabels.add(cleanLabel.toLowerCase());
                    labels.push(cleanLabel);
                }
            }
        }
        
        // Extract checkbox options
        while ((matches = patterns.checkboxPattern.exec(text)) !== null) {
            var fieldId = 'checkbox_' + matches[1].trim().toLowerCase().replace(/\s+/g, '_');
            if (!uniqueFields.has(fieldId)) {
                uniqueFields.add(fieldId);
                formFields.push({
                    type: 'checkbox',
                    label: matches[1].trim(),
                    id: fieldId
                });
            }
        }
        
        // Extract radio button options
        while ((matches = patterns.radioPattern.exec(text)) !== null) {
            var fieldId = 'radio_' + matches[1].trim().toLowerCase().replace(/\s+/g, '_');
            if (!uniqueFields.has(fieldId)) {
                uniqueFields.add(fieldId);
                formFields.push({
                    type: 'radio',
                    label: matches[1].trim(),
                    id: fieldId
                });
            }
        }
        
        // Extract underline fields
        while ((matches = patterns.underlinePattern.exec(text)) !== null) {
            var fieldId = 'text_' + matches[1].trim().toLowerCase().replace(/\s+/g, '_');
            if (!uniqueFields.has(fieldId)) {
                uniqueFields.add(fieldId);
                formFields.push({
                    type: 'text',
                    label: matches[1].trim(),
                    id: fieldId
                });
            }
        }

        // Extract numbered/lettered fields
        while ((matches = patterns.numberedPattern.exec(text)) !== null) {
            var fieldId = 'numbered_' + matches[1].trim().toLowerCase().replace(/\s+/g, '_');
            if (!uniqueFields.has(fieldId)) {
                uniqueFields.add(fieldId);
                formFields.push({
                    type: 'numbered',
                    label: matches[1].trim(),
                    id: fieldId
                });
            }
        }

        // Extract common form labels
        while ((matches = patterns.commonLabels.exec(text)) !== null) {
            var commonLabel = matches[1].trim();
            if (!uniqueLabels.has(commonLabel.toLowerCase())) {
                uniqueLabels.add(commonLabel.toLowerCase());
                labels.push(commonLabel);
            }
        }

        return {
            labels: labels,
            formFields: formFields,
            textLength: text.length,
            uniqueFieldCount: uniqueFields.size,
            uniqueLabelCount: uniqueLabels.size
        };
    },

    /**
     * Extract structured data from PDF with confidence scoring
     * @param {string} text - The extracted text from PDF
     * @returns {Object} - Structured form data with confidence scores
     */
    extractStructuredData: function(text) {
        if (!text) return { confidence: 0, data: {} };

        var formData = this.extractFormFields(text);
        var confidence = 0;

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
    },

    /**
     * Complete PDF processing: parse and extract form data with enhanced analysis
     * @param {Buffer} pdfBuffer - The PDF file as a buffer
     * @param {Object} options - Optional parsing options
     * @returns {Promise} - Promise resolving to complete analysis
     */
    processFormPDF: function(pdfBuffer, options) {
        var self = this;
        
        return this.parsePDF(pdfBuffer, options).then(function(parseResult) {
            if (!parseResult.success) {
                return parseResult;
            }
            
            var structuredData = self.extractStructuredData(parseResult.text);
            
            return {
                success: true,
                pdfInfo: {
                    pages: parseResult.numpages,
                    version: parseResult.version,
                    info: parseResult.info,
                    metadata: parseResult.metadata
                },
                text: parseResult.text,
                formAnalysis: structuredData.data,
                confidence: structuredData.confidence,
                isForm: structuredData.isForm,
                summary: structuredData.summary
            };
        });
    },

    /**
     * Process specific pages of a PDF
     * @param {Buffer} pdfBuffer - The PDF file as a buffer
     * @param {Array} pageNumbers - Array of page numbers to process (1-based)
     * @returns {Promise} - Promise resolving to page-specific analysis
     */
    processSpecificPages: function(pdfBuffer, pageNumbers) {
        var self = this;
        var options = {
            // Custom render function to process only specific pages
            render_page: function(pageData) {
                if (pageNumbers && pageNumbers.indexOf(pageData.pageIndex + 1) === -1) {
                    return null; // Skip this page
                }
                return pageData.getTextContent();
            }
        };
        
        return this.processFormPDF(pdfBuffer, options);
    },

    type: 'PDFParser'
};