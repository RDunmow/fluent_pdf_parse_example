export class PDFDocumentService {
  constructor() {
    this.tableName = "x_snc_pdf_parse_2_pdf_document";
  }

  async list() {
    try {
      const response = await fetch(`/api/now/table/${this.tableName}?sysparm_display_value=all&sysparm_order_by=sys_created_onDESC`, {
        headers: {
          "Accept": "application/json",
          "X-UserToken": window.g_ck
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load PDF documents');
      }
      
      const { result } = await response.json();
      return result || [];
    } catch (error) {
      console.error('Error loading PDF documents:', error);
      throw error;
    }
  }

  async create(data) {
    try {
      console.log('Creating record with data:', data);
      
      const response = await fetch(`/api/now/table/${this.tableName}?sysparm_display_value=all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-UserToken": window.g_ck
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create record error response:', errorText);
        throw new Error(`Failed to create PDF document: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Create record response:', responseData);
      
      return responseData.result;
    } catch (error) {
      console.error('Error creating PDF document:', error);
      throw error;
    }
  }

  async uploadAttachment(tableName, sysId, file) {
    try {
      // Try the standard ServiceNow attachment upload approach first
      return await this.uploadAttachmentStandard(tableName, sysId, file);
    } catch (error) {
      console.warn('Standard upload failed, trying alternative method:', error);
      try {
        return await this.uploadAttachmentAlternative(tableName, sysId, file);
      } catch (altError) {
        console.error('Both upload methods failed:', altError);
        throw new Error(`Failed to upload attachment: ${altError.message}`);
      }
    }
  }

  async uploadAttachmentStandard(tableName, sysId, file) {
    const formData = new FormData();
    formData.append('table_name', tableName);
    formData.append('table_sys_id', sysId);
    formData.append('file', file, file.name);

    const response = await fetch(`/api/now/attachment/upload`, {
      method: 'POST',
      headers: {
        'X-UserToken': window.g_ck
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.result || data;
  }

  async uploadAttachmentAlternative(tableName, sysId, file) {
    try {
      // Method 1: Try with multipart/form-data and specific parameters
      const formData = new FormData();
      formData.append('table_name', tableName);
      formData.append('table_sys_id', sysId);
      formData.append('uploadFile', file, file.name);
      
      const response = await fetch(`/api/now/attachment/file?table_name=${encodeURIComponent(tableName)}&table_sys_id=${encodeURIComponent(sysId)}`, {
        method: 'POST',
        headers: {
          'X-UserToken': window.g_ck
        },
        body: formData
      });

      if (!response.ok) {
        // Method 2: Try creating attachment record first, then upload content
        return await this.uploadAttachmentViaRecord(tableName, sysId, file);
      }

      const responseData = await response.json();
      return responseData.result || responseData;
    } catch (error) {
      console.error('Error in alternative upload:', error);
      throw error;
    }
  }

  async uploadAttachmentViaRecord(tableName, sysId, file) {
    try {
      // First create the attachment record
      const attachmentRecord = {
        table_name: tableName,
        table_sys_id: sysId,
        file_name: file.name,
        content_type: file.type || 'application/pdf',
        size_bytes: file.size.toString()
      };

      const createResponse = await fetch('/api/now/table/sys_attachment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserToken': window.g_ck
        },
        body: JSON.stringify(attachmentRecord)
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create attachment record: ${createResponse.status}`);
      }

      const { result } = await createResponse.json();
      const attachmentSysId = result.sys_id;

      // Then upload the file content
      const formData = new FormData();
      formData.append('file', file, file.name);

      const uploadResponse = await fetch(`/api/now/attachment/${attachmentSysId}/file`, {
        method: 'POST',
        headers: {
          'X-UserToken': window.g_ck
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        // Clean up the attachment record if upload fails
        await fetch(`/api/now/table/sys_attachment/${attachmentSysId}`, {
          method: 'DELETE',
          headers: {
            'X-UserToken': window.g_ck
          }
        });
        throw new Error(`Failed to upload file content: ${uploadResponse.status}`);
      }

      return result;
    } catch (error) {
      console.error('Error in record-based upload:', error);
      throw error;
    }
  }

  async processAttachment(recordSysId, attachmentSysId) {
    try {
      const response = await fetch('/api/now/table/sys_script_include', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserToken': window.g_ck
        },
        body: JSON.stringify({
          action: 'processAttachment',
          record_sys_id: recordSysId,
          attachment_sys_id: attachmentSysId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to trigger PDF processing');
      }

      return await response.json();
    } catch (error) {
      console.error('Error processing attachment:', error);
      throw error;
    }
  }

  async get(sysId) {
    try {
      const response = await fetch(`/api/now/table/${this.tableName}/${sysId}?sysparm_display_value=all`, {
        headers: {
          "Accept": "application/json",
          "X-UserToken": window.g_ck
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load PDF document');
      }
      
      const { result } = await response.json();
      return result;
    } catch (error) {
      console.error('Error loading PDF document:', error);
      throw error;
    }
  }

  async update(sysId, data) {
    try {
      const response = await fetch(`/api/now/table/${this.tableName}/${sysId}?sysparm_display_value=all`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-UserToken": window.g_ck
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PDF document');
      }
      
      const { result } = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating PDF document:', error);
      throw error;
    }
  }

  async getAttachments(recordSysId) {
    try {
      const response = await fetch(`/api/now/table/sys_attachment?sysparm_query=table_name=${this.tableName}^table_sys_id=${recordSysId}&sysparm_display_value=all&sysparm_order_by=sys_created_onDESC`, {
        headers: {
          "Accept": "application/json",
          "X-UserToken": window.g_ck
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load attachments');
      }
      
      const { result } = await response.json();
      return result || [];
    } catch (error) {
      console.error('Error loading attachments:', error);
      throw error;
    }
  }

  getAttachmentDownloadUrl(attachmentSysId) {
    return `/api/now/attachment/${attachmentSysId}/file`;
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}