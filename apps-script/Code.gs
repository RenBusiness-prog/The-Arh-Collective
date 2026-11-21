// The Arch Collective: application form receiver (Google Apps Script)
// Emails every application to the studio inbox AND saves a row in this Google Sheet.

const TO_EMAIL = "studio@archcollectivegh.com";
const SHEET_NAME = "Applications";

function doPost(e) {
  try {
    const p = e.parameter || {};
    if (p._gotcha) return reply({ ok: true }); // spam trap: real people never fill this

    const labels = p._labels ? JSON.parse(p._labels) : {};
    const keys = Object.keys(p).filter(function (k) { return k.charAt(0) !== "_"; });

    // 1) save to the sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    let headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    if (!headers.length) headers = ["Submitted"];
    keys.forEach(function (k) { if (headers.indexOf(k) === -1) headers.push(k); });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.appendRow(headers.map(function (h) { return h === "Submitted" ? new Date() : (p[h] || ""); }));

    // 2) email it
    const body = keys.map(function (k) { return (labels[k] || k) + "\n" + p[k]; }).join("\n\n");
    MailApp.sendEmail({
      to: TO_EMAIL,
      replyTo: p.email || TO_EMAIL,
      subject: p._subject || "New application",
      body: body
    });

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
