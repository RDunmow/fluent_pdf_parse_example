import React, { useState, useMemo, useEffect } from 'react';
import { PDFDocumentService } from './services/PDFDocumentService.js';
import PDFDocumentForm from './components/PDFDocumentForm.jsx';
import PDFDocumentList from './components/PDFDocumentList.jsx';
import PDFDocumentDetail from './components/PDFDocumentDetail.jsx';
import './app.css';

export default function App() {
  const service = useMemo(() => new PDFDocumentService(), []);
  const [currentView, setCurrentView] = useState('list');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        setCurrentView('list');
        setSelectedRecordId(null);
      } else if (hash === 'create') {
        setCurrentView('form');
        setSelectedRecordId(null);
      } else if (hash.startsWith('view/')) {
        const recordId = hash.split('/')[1];
        setCurrentView('detail');
        setSelectedRecordId(recordId);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial load
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (view, recordId = null) => {
    if (view === 'list') {
      window.location.hash = '';
    } else if (view === 'form') {
      window.location.hash = 'create';
    } else if (view === 'detail' && recordId) {
      window.location.hash = `view/${recordId}`;
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleSuccess = (record) => {
    const recordName = record.document_name?.display_value || record.document_name;
    showMessage(`PDF Document "${recordName}" created successfully!`, 'success');
    
    // Navigate to the new record after a short delay
    setTimeout(() => {
      const recordId = record.sys_id?.value || record.sys_id;
      navigate('detail', recordId);
    }, 1500);
  };

  const handleViewRecord = (recordId) => {
    navigate('detail', recordId);
  };

  const handleCreateNew = () => {
    navigate('form');
  };

  const handleBackToList = () => {
    navigate('list');
  };

  const renderNavigation = () => {
    if (currentView === 'detail') return null;
    
    return (
      <div className="app-navigation">
        <button 
          className={`nav-btn ${currentView === 'list' ? 'active' : ''}`}
          onClick={() => navigate('list')}
        >
          📋 Document List
        </button>
        <button 
          className={`nav-btn ${currentView === 'form' ? 'active' : ''}`}
          onClick={() => navigate('form')}
        >
          ➕ Create New
        </button>
      </div>
    );
  };

  const renderView = () => {
    switch(currentView) {
      case 'form':
        return (
          <PDFDocumentForm
            service={service}
            onSuccess={handleSuccess}
            onCancel={handleBackToList}
          />
        );
        
      case 'detail':
        return (
          <PDFDocumentDetail
            service={service}
            recordId={selectedRecordId}
            onBack={handleBackToList}
            onEdit={() => {/* TODO: implement edit */}}
          />
        );
        
      case 'list':
      default:
        return (
          <PDFDocumentList
            service={service}
            onViewRecord={handleViewRecord}
            onCreateNew={handleCreateNew}
          />
        );
    }
  };

  const getPageTitle = () => {
    switch(currentView) {
      case 'form':
        return 'Create New PDF Document';
      case 'detail':
        return 'PDF Document Details';
      case 'list':
      default:
        return 'PDF Document Manager';
    }
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>{getPageTitle()}</h1>
        <p>Manage PDF documents and extract form fields automatically</p>
        {renderNavigation()}
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="app-content">
        {renderView()}
      </div>

      <div className="app-footer">
        <p>Upload PDF files to automatically extract form fields and labels using advanced parsing technology</p>
      </div>
    </div>
  );
}