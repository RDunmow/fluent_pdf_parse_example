import React, { useState, useEffect } from 'react';
import { display, value } from '../utils/fields.js';
import { BrowserPDFParser } from '../utils/pdfParser.js';
import './PDFDocumentDetail.css';

export default function PDFDocumentDetail({ service, recordId, onBack, onEdit }) {
  const [document, setDocument] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [processingPDF, setProcessingPDF] = useState(false);
  const [processingProgress, setProcessingProgress] = useState('');
  const [pdfParser] = useState(() => new BrowserPDFParser());

  useEffect(() => {
    loadDocument();
    loadAttachments();
  }, [recordId, service]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await service.get(recordId);
      setDocument(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    try {
      setAttachmentsLoading(true);
      const attachmentData = await service.getAttachments(recordId);
      setAttachments(attachmentData);
    } catch (err) {
      console.error('Error loading attachments:', err);
      // Don't show attachment errors as main errors
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const formatDate = (dateField) => {
    const dateValue = display(dateField);
    if (!dateValue) return 'Not available';
    
    try {
      return new Date(dateValue).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateValue;
    }
  };

  const getStatusBadge = (status) => {
    const statusValue = display(status);
    const statusClass = `status-badge status-${statusValue.toLowerCase()}`;
    return <span className={statusClass}>{statusValue}</span>;
  };

  const parseJsonField = (jsonField) => {
    try {
      const jsonString = display(jsonField);
      if (!jsonString) return null;
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  const processPDFAttachment = async (attachmentId, fileName) => {
    try {
      setProcessingPDF(true);
      setProcessingProgress(`Downloading ${fileName}...`);
      
      // Download the attachment
      const response = await fetch(service.getAttachmentDownloadUrl(attachmentId));
      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      setProcessingProgress(`Processing PDF content...`);
      
      // Process the PDF in the browser
      const result = await pdfParser.processFormPDF(arrayBuffer);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setProcessingProgress(`Updating record...`);
      
      // Update the record with the parsing results
      const updateData = {
        parsing_status: 'completed',
        parsing_confidence: result.confidence || 0,
        is_form_document: result.isForm || false,
        extracted_text: result.text?.substring(0, 8000) || '', // Limit to 8000 chars
        parsed_on: new Date().toISOString(),
        parsing_error: ''
      };
      
      // PDF metadata
      if (result.pdfInfo) {
        updateData.pdf_pages = result.pdfInfo.pages || 0;
        updateData.pdf_version = result.pdfInfo.info?.PDFFormatVersion || '';
        updateData.pdf_metadata = JSON.stringify(result.pdfInfo).substring(0, 4000);
      }
      
      // Form analysis results
      if (result.summary) {
        updateData.form_labels_found = result.summary.totalLabels || 0;
        updateData.form_fields_found = result.summary.totalFields || 0;
        updateData.has_text_fields = result.summary.hasTextFields || false;
        updateData.has_checkboxes = result.summary.hasCheckboxes || false;
        updateData.has_radio_buttons = result.summary.hasRadioButtons || false;
      }
      
      // Store detailed analysis as JSON
      if (result.formAnalysis) {
        const analysisJson = JSON.stringify(result.formAnalysis);
        updateData.form_analysis_data = analysisJson.substring(0, 8000);
      }
      
      // Update the record
      await service.update(recordId, updateData);
      
      // Reload the document to show updated data
      await loadDocument();
      
      setProcessingProgress(`Processing completed successfully!`);
      
      // Show success message for a moment, then clear
      setTimeout(() => {
        setProcessingProgress('');
        setProcessingPDF(false);
      }, 2000);
      
    } catch (error) {
      console.error('PDF processing error:', error);
      
      // Update record with error status
      try {
        await service.update(recordId, {
          parsing_status: 'failed',
          parsing_error: error.message,
          parsed_on: new Date().toISOString()
        });
        await loadDocument();
      } catch (updateError) {
        console.error('Error updating record with error status:', updateError);
      }
      
      setProcessingProgress(`Error: ${error.message}`);
      
      // Clear error after a delay
      setTimeout(() => {
        setProcessingProgress('');
        setProcessingPDF(false);
      }, 5000);
    }
  };

  const handleProcessPDF = async (attachmentId, fileName) => {
    if (processingPDF) return;
    
    if (!BrowserPDFParser.isPDF({ name: fileName })) {
      alert('Please select a PDF file to process.');
      return;
    }
    
    const confirmed = window.confirm(
      `Process ${fileName} and extract form data?\n\nThis will:\n• Extract text content\n• Identify form fields and labels\n• Update this record with the results`
    );
    
    if (confirmed) {
      await processPDFAttachment(attachmentId, fileName);
    }
  };

  if (loading) {
    return (
      <div className="pdf-detail-container">
        <div className="loading">Loading document details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-detail-container">
        <div className="error-message">{error}</div>
        <button onClick={onBack} className="btn-back">
          Back to List
        </button>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="pdf-detail-container">
        <div className="error-message">Document not found</div>
        <button onClick={onBack} className="btn-back">
          Back to List
        </button>
      </div>
    );
  }

  const formAnalysis = parseJsonField(document.form_analysis_data);
  const pdfMetadata = parseJsonField(document.pdf_metadata);

  return (
    <div className="pdf-detail-container">
      <div className="detail-header">
        <button onClick={onBack} className="btn-back">
          ← Back to List
        </button>
        <h1>{display(document.document_name)}</h1>
        <div className="header-badges">
          {getStatusBadge(document.parsing_status)}
          {display(document.is_form_document) === 'true' && (
            <span className="form-badge">📋 Form Document</span>
          )}
        </div>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'parsing' ? 'active' : ''}`}
            onClick={() => setActiveTab('parsing')}
          >
            Parsing Results
          </button>
          <button 
            className={`tab ${activeTab === 'attachments' ? 'active' : ''}`}
            onClick={() => setActiveTab('attachments')}
          >
            Attachments ({attachments.length})
          </button>
          <button 
            className={`tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            Content
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="info-grid">
                <div className="info-card">
                  <h3>Document Information</h3>
                  <div className="info-row">
                    <span className="label">Name:</span>
                    <span className="value">{display(document.document_name)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Type:</span>
                    <span className="value">{display(document.document_type)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Description:</span>
                    <span className="value">{display(document.description) || 'No description'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Created:</span>
                    <span className="value">{formatDate(document.sys_created_on)}</span>
                  </div>
                </div>

                <div className="info-card">
                  <h3>PDF Properties</h3>
                  <div className="info-row">
                    <span className="label">Pages:</span>
                    <span className="value">{display(document.pdf_pages) || 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Version:</span>
                    <span className="value">{display(document.pdf_version) || 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Text Length:</span>
                    <span className="value">{display(document.extracted_text)?.length || 0} characters</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'parsing' && (
            <div className="parsing-tab">
              <div className="parsing-summary">
                <div className="summary-card">
                  <h3>Parsing Summary</h3>
                  <div className="summary-stats">
                    <div className="stat-item">
                      <div className="stat-value">{display(document.parsing_confidence) || '0'}%</div>
                      <div className="stat-label">Confidence</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{display(document.form_labels_found) || '0'}</div>
                      <div className="stat-label">Labels Found</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{display(document.form_fields_found) || '0'}</div>
                      <div className="stat-label">Fields Found</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="field-types">
                <h3>Detected Field Types</h3>
                <div className="field-type-badges">
                  {display(document.has_text_fields) === 'true' && 
                    <span className="field-badge text-fields">Text Fields</span>
                  }
                  {display(document.has_checkboxes) === 'true' && 
                    <span className="field-badge checkboxes">Checkboxes</span>
                  }
                  {display(document.has_radio_buttons) === 'true' && 
                    <span className="field-badge radio-buttons">Radio Buttons</span>
                  }
                  {!display(document.has_text_fields) && !display(document.has_checkboxes) && !display(document.has_radio_buttons) &&
                    <span className="no-fields">No form fields detected</span>
                  }
                </div>
              </div>

              {formAnalysis && (
                <div className="form-analysis">
                  <h3>Form Analysis Details</h3>
                  {formAnalysis.labels && formAnalysis.labels.length > 0 && (
                    <div className="analysis-section">
                      <h4>Labels ({formAnalysis.labels.length})</h4>
                      <div className="labels-list">
                        {formAnalysis.labels.map((label, index) => (
                          <span key={index} className="label-tag">{label}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {formAnalysis.formFields && formAnalysis.formFields.length > 0 && (
                    <div className="analysis-section">
                      <h4>Form Fields ({formAnalysis.formFields.length})</h4>
                      <div className="fields-list">
                        {formAnalysis.formFields.map((field, index) => (
                          <div key={index} className="field-item">
                            <span className="field-type">{field.type}</span>
                            <span className="field-label">{field.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {display(document.parsing_error) && (
                <div className="parsing-error">
                  <h3>Parsing Error</h3>
                  <div className="error-content">
                    {display(document.parsing_error)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="attachments-tab">
              <h3>File Attachments</h3>
              
              {processingPDF && (
                <div className="processing-status">
                  <div className="processing-indicator">
                    <div className="spinner"></div>
                    <span>{processingProgress}</span>
                  </div>
                </div>
              )}
              
              {attachmentsLoading ? (
                <div className="loading">Loading attachments...</div>
              ) : attachments.length === 0 ? (
                <div className="no-attachments">
                  <p>No attachments found for this document.</p>
                </div>
              ) : (
                <div className="attachments-list">
                  {attachments.map(attachment => (
                    <div key={value(attachment.sys_id)} className="attachment-item">
                      <div className="attachment-icon">
                        {display(attachment.content_type).includes('pdf') ? '📄' : '📎'}
                      </div>
                      
                      <div className="attachment-info">
                        <div className="attachment-name">
                          {display(attachment.file_name)}
                        </div>
                        <div className="attachment-details">
                          <span className="file-size">
                            {service.formatFileSize(parseInt(display(attachment.size_bytes) || '0'))}
                          </span>
                          <span className="file-type">
                            {display(attachment.content_type)}
                          </span>
                          <span className="upload-date">
                            Uploaded: {formatDate(attachment.sys_created_on)}
                          </span>
                        </div>
                        {display(attachment.description) && (
                          <div className="attachment-description">
                            {display(attachment.description)}
                          </div>
                        )}
                      </div>
                      
                      <div className="attachment-actions">
                        {display(attachment.content_type).includes('pdf') && (
                          <button
                            onClick={() => handleProcessPDF(value(attachment.sys_id), display(attachment.file_name))}
                            disabled={processingPDF}
                            className="btn-process-pdf"
                            title="Process PDF and extract form data"
                          >
                            🔍 Process PDF
                          </button>
                        )}
                        <a 
                          href={service.getAttachmentDownloadUrl(value(attachment.sys_id))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-download"
                          title="Download attachment"
                        >
                          ⬇️ Download
                        </a>
                        <a 
                          href={service.getAttachmentDownloadUrl(value(attachment.sys_id))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-view"
                          title="View attachment"
                        >
                          👁️ View
                        </a>
                      </div>
                    </div>
                  ))}
                  
                  <div className="attachments-summary">
                    <p>
                      <strong>{attachments.length}</strong> attachment{attachments.length !== 1 ? 's' : ''} 
                      ({attachments.reduce((total, att) => total + parseInt(display(att.size_bytes) || '0'), 0) > 0 
                        ? service.formatFileSize(attachments.reduce((total, att) => total + parseInt(display(att.size_bytes) || '0'), 0))
                        : '0 B'} total)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'content' && (
            <div className="content-tab">
              <h3>Extracted Text Content</h3>
              <div className="text-content">
                {display(document.extracted_text) || 'No text content extracted'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}