import '@servicenow/sdk/global';
import { Table, StringColumn, IntegerColumn, DecimalColumn, BooleanColumn, DateTimeColumn, ChoiceColumn } from '@servicenow/sdk/core'

// IMPORTANT: The exported constant name MUST match the name property value
export const x_snc_pdf_parse_2_pdf_document = Table({
    name: 'x_snc_pdf_parse_2_pdf_document',
    label: 'PDF Document',
    schema: {
        // Basic document information
        document_name: StringColumn({
            label: 'Document Name',
            maxLength: 255,
            mandatory: true
        }),
        
        description: StringColumn({
            label: 'Description',
            maxLength: 1000
        }),
        
        document_type: ChoiceColumn({
            label: 'Document Type',
            choices: {
                form: { label: 'Form', sequence: 0 },
                contract: { label: 'Contract', sequence: 1 },
                invoice: { label: 'Invoice', sequence: 2 },
                application: { label: 'Application', sequence: 3 },
                report: { label: 'Report', sequence: 4 },
                other: { label: 'Other', sequence: 5 }
            },
            dropdown: 'dropdown_with_none',
            default: 'other'
        }),
        
        // PDF parsing results
        parsing_status: ChoiceColumn({
            label: 'Parsing Status',
            choices: {
                pending: { label: 'Pending', sequence: 0 },
                processing: { label: 'Processing', sequence: 1 },
                completed: { label: 'Completed', sequence: 2 },
                failed: { label: 'Failed', sequence: 3 }
            },
            dropdown: 'dropdown_with_none',
            default: 'pending'
        }),
        
        parsing_confidence: DecimalColumn({
            label: 'Parsing Confidence (%)',
            maxLength: 5
        }),
        
        is_form_document: BooleanColumn({
            label: 'Is Form Document',
            default: false
        }),
        
        // PDF metadata
        pdf_pages: IntegerColumn({
            label: 'Number of Pages'
        }),
        
        pdf_version: StringColumn({
            label: 'PDF Version',
            maxLength: 10
        }),
        
        // Extracted content
        extracted_text: StringColumn({
            label: 'Extracted Text',
            maxLength: 8000  // Large text field for full content
        }),
        
        form_labels_found: IntegerColumn({
            label: 'Form Labels Found'
        }),
        
        form_fields_found: IntegerColumn({
            label: 'Form Fields Found'  
        }),
        
        // Field types detected
        has_text_fields: BooleanColumn({
            label: 'Has Text Fields',
            default: false
        }),
        
        has_checkboxes: BooleanColumn({
            label: 'Has Checkboxes',
            default: false
        }),
        
        has_radio_buttons: BooleanColumn({
            label: 'Has Radio Buttons', 
            default: false
        }),
        
        // Detailed parsing results (JSON)
        form_analysis_data: StringColumn({
            label: 'Form Analysis Data',
            maxLength: 8000  // Store JSON data
        }),
        
        pdf_metadata: StringColumn({
            label: 'PDF Metadata',
            maxLength: 4000  // Store PDF metadata as JSON
        }),
        
        // Processing timestamps
        parsed_on: DateTimeColumn({
            label: 'Parsed On'
        }),
        
        // Error information
        parsing_error: StringColumn({
            label: 'Parsing Error',
            maxLength: 1000
        })
    },
    
    // Table configuration
    display: 'document_name',
    extensible: false,
    audit: true,
    allow_web_service_access: true,
    actions: ['create', 'read', 'update', 'delete'],
    accessible_from: 'package_private',
    
    // Auto-numbering for documents
    auto_number: {
        prefix: 'PDF',
        number: 1000,
        number_of_digits: 4
    }
});