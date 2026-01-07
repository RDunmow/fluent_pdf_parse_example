import { gs } from '@servicenow/glide';
import { GlideRecord } from '@servicenow/glide';
import { GlideSysAttachment } from '@servicenow/glide';

// Import our helper functions
const { processPDFFromAttachment } = require('../script-includes/pdf-document-helper.js');

// Parse PDF Attachment UI Action Script
// This script processes PDF attachments and extracts form data

try {
    // Get the current record sys_id
    var currentSysId = current.getUniqueValue();
    
    if (!currentSysId) {
        gs.addErrorMessage('Unable to determine current record ID');
        action.setRedirectURL(current);
        return;
    }
    
    // Find PDF attachments on the current record
    var attachmentGr = new GlideRecord('sys_attachment');
    attachmentGr.addQuery('table_name', 'x_snc_pdf_parse_2_pdf_document');
    attachmentGr.addQuery('table_sys_id', currentSysId);
    attachmentGr.addQuery('content_type', 'application/pdf');
    attachmentGr.orderByDesc('sys_created_on');
    attachmentGr.query();
    
    var attachmentCount = 0;
    var processedCount = 0;
    var errorCount = 0;
    
    // Process each PDF attachment
    while (attachmentGr.next()) {
        attachmentCount++;
        
        var attachmentSysId = attachmentGr.getUniqueValue();
        var fileName = attachmentGr.getValue('file_name');
        
        gs.info('Processing PDF attachment: ' + fileName + ' (ID: ' + attachmentSysId + ')');
        
        try {
            // Update current record status to processing
            current.setValue('parsing_status', 'processing');
            current.setValue('parsing_error', '');
            current.update();
            
            // Get the attachment data
            var attachment = new GlideSysAttachment();
            var attachmentBytes = attachment.getContentStream(attachmentSysId);
            
            if (!attachmentBytes) {
                gs.error('Could not retrieve attachment data for: ' + fileName);
                errorCount++;
                continue;
            }
            
            // Create a PDF parser instance
            var pdfParser = new global.PDFParser();
            
            // Process the PDF asynchronously
            pdfParser.processFormPDF(attachmentBytes).then(function(result) {
                try {
                    // Update the current record with parsing results
                    var updateGr = new GlideRecord('x_snc_pdf_parse_2_pdf_document');
                    if (updateGr.get(currentSysId)) {
                        
                        if (result.success) {
                            // Update with successful parsing results
                            updateGr.setValue('parsing_status', 'completed');
                            updateGr.setValue('parsing_confidence', result.confidence || 0);
                            updateGr.setValue('is_form_document', result.isForm || false);
                            
                            // PDF metadata
                            if (result.pdfInfo) {
                                updateGr.setValue('pdf_pages', result.pdfInfo.pages || 0);
                                updateGr.setValue('pdf_version', result.pdfInfo.version || '');
                                updateGr.setValue('pdf_metadata', JSON.stringify(result.pdfInfo));
                            }
                            
                            // Extracted content
                            var extractedText = result.text || '';
                            if (extractedText.length > 8000) {
                                extractedText = extractedText.substring(0, 7990) + '...[TRUNCATED]';
                            }
                            updateGr.setValue('extracted_text', extractedText);
                            
                            // Form analysis results
                            if (result.summary) {
                                updateGr.setValue('form_labels_found', result.summary.totalLabels || 0);
                                updateGr.setValue('form_fields_found', result.summary.totalFields || 0);
                                updateGr.setValue('has_text_fields', result.summary.hasTextFields || false);
                                updateGr.setValue('has_checkboxes', result.summary.hasCheckboxes || false);
                                updateGr.setValue('has_radio_buttons', result.summary.hasRadioButtons || false);
                            }
                            
                            // Store detailed analysis as JSON
                            if (result.formAnalysis) {
                                var analysisJson = JSON.stringify(result.formAnalysis);
                                if (analysisJson.length > 8000) {
                                    analysisJson = analysisJson.substring(0, 7990) + '...[TRUNCATED]';
                                }
                                updateGr.setValue('form_analysis_data', analysisJson);
                            }
                            
                            // Clear any previous error
                            updateGr.setValue('parsing_error', '');
                            
                            gs.addInfoMessage('PDF parsing completed successfully for: ' + fileName + 
                                            '. Confidence: ' + (result.confidence || 0) + '%' +
                                            ', Labels found: ' + (result.summary ? result.summary.totalLabels : 0) +
                                            ', Fields found: ' + (result.summary ? result.summary.totalFields : 0));
                            
                        } else {
                            // Update with parsing failure
                            updateGr.setValue('parsing_status', 'failed');
                            updateGr.setValue('parsing_error', result.error || 'Unknown parsing error');
                            
                            gs.addErrorMessage('PDF parsing failed for: ' + fileName + '. Error: ' + result.error);
                        }
                        
                        // Set parsing timestamp
                        updateGr.setValue('parsed_on', gs.nowDateTime());
                        updateGr.update();
                        
                    } else {
                        gs.error('Could not retrieve PDF document record for update: ' + currentSysId);
                    }
                    
                } catch (updateError) {
                    gs.error('Error updating PDF document record: ' + updateError.message);
                }
            }).catch(function(parseError) {
                // Handle parsing errors
                try {
                    var errorGr = new GlideRecord('x_snc_pdf_parse_2_pdf_document');
                    if (errorGr.get(currentSysId)) {
                        errorGr.setValue('parsing_status', 'failed');
                        errorGr.setValue('parsing_error', 'Processing exception: ' + parseError);
                        errorGr.setValue('parsed_on', gs.nowDateTime());
                        errorGr.update();
                    }
                    
                    gs.addErrorMessage('PDF processing exception for: ' + fileName + '. Error: ' + parseError);
                } catch (errorHandlingError) {
                    gs.error('Error handling PDF processing exception: ' + errorHandlingError.message);
                }
            });
            
            processedCount++;
            
        } catch (processingError) {
            gs.error('Error processing PDF attachment ' + fileName + ': ' + processingError.message);
            errorCount++;
            
            // Update record with error status
            current.setValue('parsing_status', 'failed');
            current.setValue('parsing_error', 'Processing error: ' + processingError.message);
            current.setValue('parsed_on', gs.nowDateTime());
            current.update();
        }
    }
    
    // Provide feedback to user
    if (attachmentCount === 0) {
        gs.addInfoMessage('No PDF attachments found on this record to parse');
    } else {
        var message = 'Found ' + attachmentCount + ' PDF attachment(s). ';
        if (processedCount > 0) {
            message += processedCount + ' submitted for processing. ';
        }
        if (errorCount > 0) {
            message += errorCount + ' failed to process. ';
        }
        message += 'Check the record fields for parsing results.';
        
        gs.addInfoMessage(message);
    }
    
} catch (mainError) {
    gs.error('Main UI Action error: ' + mainError.message);
    gs.addErrorMessage('An error occurred while processing PDF attachments: ' + mainError.message);
    
    // Update record with error status
    current.setValue('parsing_status', 'failed');
    current.setValue('parsing_error', 'UI Action error: ' + mainError.message);
    current.setValue('parsed_on', gs.nowDateTime());
    current.update();
}

// Refresh the form to show updated fields
action.setRedirectURL(current);