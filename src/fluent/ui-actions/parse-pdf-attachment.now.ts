import '@servicenow/sdk/global'
import { UiAction } from '@servicenow/sdk/core'

export const parsePDFAttachment = UiAction({
    $id: Now.ID['parse_pdf_attachment'],
    table: 'x_snc_pdf_parse_2_pdf_document',
    name: 'Parse PDF Attachment',
    actionName: 'parse_pdf_attachment',
    active: true,
    hint: 'Parse PDF attachments and extract form data',
    showUpdate: true,
    showInsert: false,
    form: {
        showButton: true,
        style: 'primary',
    },
    condition: `current.parsing_status == 'pending' || current.parsing_status == 'failed'`,
    script: Now.include('../../server/ui-actions/parse-pdf-attachment.js')
})