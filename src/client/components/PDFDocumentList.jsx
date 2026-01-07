import React, { useState, useEffect } from 'react';
import { display, value } from '../utils/fields.js';
import './PDFDocumentList.css';

export default function PDFDocumentList({ service, onViewRecord, onCreateNew }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [service]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await service.list();
      setDocuments(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClass = `status-badge status-${display(status).toLowerCase()}`;
    return <span className={statusClass}>{display(status)}</span>;
  };

  const getConfidenceBadge = (confidence) => {
    const conf = parseFloat(display(confidence) || '0');
    let badgeClass = 'confidence-badge ';
    
    if (conf >= 75) badgeClass += 'confidence-high';
    else if (conf >= 50) badgeClass += 'confidence-medium';
    else badgeClass += 'confidence-low';
    
    return <span className={badgeClass}>{conf}%</span>;
  };

  const formatDate = (dateField) => {
    const dateValue = display(dateField);
    if (!dateValue) return '-';
    
    try {
      return new Date(dateValue).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateValue;
    }
  };

  if (loading) {
    return (
      <div className="pdf-list-container">
        <div className="loading">Loading PDF documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-list-container">
        <div className="error-message">{error}</div>
        <button onClick={loadDocuments} className="btn-retry">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="pdf-list-container">
      <div className="list-header">
        <h2>PDF Documents</h2>
        <button onClick={onCreateNew} className="btn-create">
          Create New Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <p>No PDF documents found.</p>
          <button onClick={onCreateNew} className="btn-create">
            Create Your First Document
          </button>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map(doc => (
            <div 
              key={value(doc.sys_id)}
              className="document-card"
              onClick={() => onViewRecord(value(doc.sys_id))}
            >
              <div className="card-header">
                <h3 className="document-name">
                  {display(doc.document_name)}
                </h3>
                <div className="document-type">
                  {display(doc.document_type)}
                </div>
              </div>

              <div className="card-body">
                {display(doc.description) && (
                  <p className="document-description">
                    {display(doc.description)}
                  </p>
                )}

                <div className="document-stats">
                  <div className="stat-row">
                    <span className="stat-label">Status:</span>
                    {getStatusBadge(doc.parsing_status)}
                  </div>

                  {display(doc.parsing_confidence) && (
                    <div className="stat-row">
                      <span className="stat-label">Confidence:</span>
                      {getConfidenceBadge(doc.parsing_confidence)}
                    </div>
                  )}

                  {display(doc.pdf_pages) && (
                    <div className="stat-row">
                      <span className="stat-label">Pages:</span>
                      <span>{display(doc.pdf_pages)}</span>
                    </div>
                  )}

                  {display(doc.form_fields_found) && (
                    <div className="stat-row">
                      <span className="stat-label">Form Fields:</span>
                      <span>{display(doc.form_fields_found)}</span>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <div className="created-info">
                    Created: {formatDate(doc.sys_created_on)}
                  </div>
                  {display(doc.is_form_document) === 'true' && (
                    <div className="form-indicator">📋 Form Document</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}