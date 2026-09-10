/**
 * FreshCart onboarding -> Google Sheets webhook
 *
 * Create/open the Google Sheet where you want applications stored.
 * Extensions -> Apps Script -> paste this file -> Deploy as Web app.
 * Execute as: Me
 * Who has access: Anyone
 * Copy the web app URL into Vercel as GOOGLE_SHEETS_WEBHOOK_URL.
 *
 * The script creates two tabs automatically:
 *   1) Shopkeeper Applications
 *   2) Employee Applications
 */

const SHEETS = {
  shopkeeper: {
    name: 'Shopkeeper Applications',
    headers: [
      'Reference ID', 'Application Type', 'Submitted At', 'Status', 'Call Status', 'Preferred Call At',
      'Full Name', 'Email', 'Phone', 'Address', 'City', 'State', 'PIN Code',
      'ID Proof Type', 'ID Proof Number', 'Business / Store Name', 'Business Type', 'GSTIN', 'Business PAN',
      'Trade / Shop Licence', 'FSSAI Licence', 'Established Year', 'Branches', 'Consent Time'
    ]
  },
  employee: {
    name: 'Employee Applications',
    headers: [
      'Reference ID', 'Application Type', 'Submitted At', 'Status', 'Call Status', 'Preferred Call At',
      'Full Name', 'Email', 'Phone', 'Address', 'City', 'State', 'PIN Code',
      'ID Proof Type', 'ID Proof Number', 'Qualification', 'Experience (Years)', 'Preferred Role',
      'Availability', 'Emergency Contact Name', 'Emergency Contact Phone', 'Consent Time'
    ]
  }
};

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'FreshCart onboarding sheet webhook' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Missing request body');
    const data = JSON.parse(e.postData.contents);
    if (!['shopkeeper', 'employee'].includes(data.type)) throw new Error('Invalid application type');

    const config = SHEETS[data.type];
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(config.name);
    if (!sheet) sheet = spreadsheet.insertSheet(config.name);

    ensureHeader(sheet, config.headers);

    const row = data.type === 'shopkeeper'
      ? [
          data.referenceId || '', data.type || '', data.submittedAt || '', data.status || '', data.callStatus || '', data.preferredCallAt || '',
          data.fullName || '', data.email || '', data.phone || '', data.address || '', data.city || '', data.state || '', data.postalCode || '',
          data.idProofType || '', data.idProofNumber || '', data.businessName || '', data.businessType || '', data.gstin || '', data.pan || '',
          data.tradeLicense || '', data.fssaiLicense || '', data.establishmentYear || '', data.branches || '', data.consentedAt || ''
        ]
      : [
          data.referenceId || '', data.type || '', data.submittedAt || '', data.status || '', data.callStatus || '', data.preferredCallAt || '',
          data.fullName || '', data.email || '', data.phone || '', data.address || '', data.city || '', data.state || '', data.postalCode || '',
          data.idProofType || '', data.idProofNumber || '', data.qualification || '', data.experience || '', data.preferredRole || '',
          data.availability || '', data.emergencyContactName || '', data.emergencyContactPhone || '', data.consentedAt || ''
        ];

    sheet.appendRow(row);
    return json({ ok: true, referenceId: data.referenceId || null });
  } catch (error) {
    return json({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function ensureHeader(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, headers.length);
  }
}

function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
