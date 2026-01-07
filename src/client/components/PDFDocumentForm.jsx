import React, { useState } from 'react';
import { BrowserPDFParser } from '../utils/pdfParser.js';
import './PDFDocumentForm.css';

export default function PDFDocumentForm({ service, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    document_name: '',
    description: '',
    document_type: 'other'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [processOnUpload, setProcessOnUpload] = useState(true);
  const [pdfParser] = useState(() => new BrowserPDFParser());

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
      
      // Auto-populate document name if empty
      if (!formData.document_name) {
        setFormData(prev => ({
          ...prev,
          document_name: file.name.replace('.pdf', '')
        }));
      }
    } else {
      setError('Please select a valid PDF file');
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      let recordData = { ...formData };
      
      // If process on upload is enabled and we have a PDF file, process it first
      if (processOnUpload && selectedFile && BrowserPDFParser.isPDF(selectedFile)) {
        try {
          const result = await pdfParser.processFormPDF(selectedFile);
          
          if (result.success) {
            // Pre-populate the record with parsing results
            recordData = {
              ...recordData,
              parsing_status: 'completed',
              parsing_confidence: result.confidence || 0,
              is_form_document: result.isForm || false,
              extracted_text: result.text?.substring(0, 8000) || '',
              parsed_on: new Date().toISOString(),
              parsing_error: ''
            };
            
            // PDF metadata
            if (result.pdfInfo) {
              recordData.pdf_pages = result.pdfInfo.pages || 0;
              recordData.pdf_version = result.pdfInfo.info?.PDFFormatVersion || '';
              recordData.pdf_metadata = JSON.stringify(result.pdfInfo).substring(0, 4000);
            }
            
            // Form analysis results
            if (result.summary) {
              recordData.form_labels_found = result.summary.totalLabels || 0;
              recordData.form_fields_found = result.summary.totalFields || 0;
              recordData.has_text_fields = result.summary.hasTextFields || false;
              recordData.has_checkboxes = result.summary.hasCheckboxes || false;
              recordData.has_radio_buttons = result.summary.hasRadioButtons || false;
            }
            
            // Store detailed analysis as JSON
            if (result.formAnalysis) {
              const analysisJson = JSON.stringify(result.formAnalysis);
              recordData.form_analysis_data = analysisJson.substring(0, 8000);
            }
          }
        } catch (processError) {
          console.warn('PDF processing failed, continuing with record creation:', processError);
          // Continue with record creation even if processing fails
          recordData.parsing_status = 'failed';
          recordData.parsing_error = processError.message;
        }
      }
      
      // Create the PDF document record
      const record = await service.create(recordData);
      console.log('Created record:', record);
      
      // Upload the attachment if a file was selected
      if (selectedFile) {
        const recordSysId = record.sys_id?.value || record.sys_id;
        console.log('Uploading to record sys_id:', recordSysId);
        
        if (!recordSysId) {
          throw new Error('Record was created but sys_id is missing');
        }
        
        await service.uploadAttachment(
          'x_snc_pdf_parse_2_pdf_document',
          recordSysId,
          selectedFile
        );
      }

      onSuccess(record);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pdf-form-container">
      <h2>Create New PDF Document</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="pdf-form">
        <div className="form-group">
          <label htmlFor="document_name">Document Name *</label>
          <input
            type="text"
            id="document_name"
            name="document_name"
            value={formData.document_name}
            onChange={handleChange}
            required
            maxLength="255"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            maxLength="1000"
            rows="3"
          />
        </div>

        <div className="form-group">
          <label htmlFor="document_type">Document Type</label>
          <select
            id="document_type"
            name="document_type"
            value={formData.document_type}
            onChange={handleChange}
          >
            <option value="other">Other</option>
            <option value="form">Form</option>
            <option value="contract">Contract</option>
            <option value="invoice">Invoice</option>
            <option value="application">Application</option>
            <option value="report">Report</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pdf_file">Upload PDF File</label>
          <input
            type="file"
            id="pdf_file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
          />
          {selectedFile && (
            <div className="file-info">
              Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </div>
          )}
          
          {selectedFile && BrowserPDFParser.isPDF(selectedFile) && (
            <div className="process-option">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={processOnUpload}
                  onChange={(e) => setProcessOnUpload(e.target.checked)}
                />
                <span>🔍 Process PDF and extract form data automatically</span>
              </label>
              <small className="help-text">
                This will analyze the PDF in your browser and extract text, form fields, and labels before saving.
              </small>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn-cancel"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Document'}
          </button>
        </div>
      </form>
    </div>
  );
}