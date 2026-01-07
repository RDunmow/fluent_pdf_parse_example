import '@servicenow/sdk/global';
import { ScriptInclude } from '@servicenow/sdk/core'

export const PDFDocumentHelper = ScriptInclude({
    $id: Now.ID['PDFDocumentHelper'],
    name: 'PDFDocumentHelper',
    script: Now.include('../../server/script-includes/pdf-document-helper.js'),
    description: 'Helper functions for managing PDF document records and integrating with PDF parsing',
    apiName: 'x_snc_pdf_parse_2.PDFDocumentHelper',
    clientCallable: false,
    active: true,
});