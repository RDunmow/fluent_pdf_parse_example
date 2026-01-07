import '@servicenow/sdk/global';
import { UiPage } from '@servicenow/sdk/core';
import pdfPage from '../../client/index.html';

export const pdf_document_manager = UiPage({
  $id: Now.ID['pdf-document-manager'],
  endpoint: 'x_snc_pdf_parse_2_pdf_manager.do',
  html: pdfPage,
  direct: true
});