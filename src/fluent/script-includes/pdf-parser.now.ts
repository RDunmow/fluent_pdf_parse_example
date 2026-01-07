import '@servicenow/sdk/global';
import { ScriptInclude } from '@servicenow/sdk/core'

export const PDFParser = ScriptInclude({
    $id: Now.ID['PDFParser'],
    name: 'PDFParser',
    script: Now.include('../../server/script-includes/pdf-parser.js'),
    description: 'Script Include for parsing PDF files and extracting form labels and fields using pdf-parse TypeScript library',
    apiName: 'x_snc_pdf_parse_2.PDFParser',
    clientCallable: true,
    active: true,
});