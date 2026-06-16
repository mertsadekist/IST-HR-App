import QRCode from 'qrcode';

/**
 * Generate a unique asset code like "IST-LAP-00001"
 */
export function generateAssetCode(companyShortCode, categoryPrefix, sequenceNumber) {
  const code = companyShortCode || 'AST';
  const prefix = categoryPrefix || 'ITM';
  const seq = String(sequenceNumber).padStart(5, '0');
  return `${code}-${prefix}-${seq}`;
}

/**
 * Get a short category prefix from the platform/category name
 */
export function getCategoryPrefix(name) {
  if (!name) return 'ITM';
  const map = {
    'laptop': 'LAP', 'desktop': 'DSK', 'monitor': 'MON', 'screen': 'MON',
    'phone': 'PHN', 'mobile': 'PHN', 'tablet': 'TAB', 'printer': 'PRT',
    'server': 'SRV', 'router': 'RTR', 'switch': 'SWT', 'keyboard': 'KBD',
    'mouse': 'MOU', 'headset': 'HDS', 'camera': 'CAM', 'projector': 'PRJ',
    'chair': 'CHR', 'desk': 'DSK', 'furniture': 'FRN', 'vehicle': 'VHL',
    'access card': 'ACS', 'card': 'ACS', 'license': 'LIC', 'software': 'SFT',
  };
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val;
  }
  return name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'ITM';
}

/**
 * Generate QR Code as data URL (no native dependencies needed)
 */
export async function generateQRCodeDataURL(data) {
  if (!data) return '';
  try {
    return await QRCode.toDataURL(data, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('QR Code generation error:', err.message);
    return '';
  }
}

/**
 * Generate QR Code as SVG string
 */
export async function generateQRCodeSVG(data) {
  if (!data) return '';
  try {
    return await QRCode.toString(data, { type: 'svg', width: 150, margin: 1 });
  } catch (err) {
    console.error('QR SVG generation error:', err.message);
    return '';
  }
}

/**
 * Generate a single printable label HTML (barcode rendered client-side)
 */
export function generateLabelHTML(item, companyName, qrDataURL) {
  return `
    <div style="width:63.5mm;height:33.9mm;border:0.5px dashed #ccc;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:6pt;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${companyName || 'Company'}</div>
          <div style="font-size:10pt;font-weight:bold;color:#111;margin-top:1mm;letter-spacing:1px;">${item.asset_code || ''}</div>
          <div style="font-size:7pt;color:#333;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.brand || ''} ${item.model || ''}</div>
          ${item.serial_number ? `<div style="font-size:6pt;color:#666;margin-top:0.5mm;">S/N: ${item.serial_number}</div>` : ''}
        </div>
        ${qrDataURL ? `<img src="${qrDataURL}" style="width:16mm;height:16mm;margin-left:2mm;" />` : ''}
      </div>
      <div style="font-size:7pt;color:#999;text-align:center;margin-top:1mm;font-family:monospace;letter-spacing:2px;">${item.asset_code || ''}</div>
    </div>
  `;
}

/**
 * Generate A4 page with multiple labels (Avery L7160: 7 rows × 3 cols = 21 labels)
 */
export function generateBulkLabelsHTML(labels) {
  const labelsHTML = labels.map(l => l.html).join('');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Asset Labels</title>
  <style>
    @page { size: A4; margin: 10mm 7mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .label-grid {
      display: grid;
      grid-template-columns: repeat(3, 63.5mm);
      grid-auto-rows: 33.9mm;
      gap: 2.5mm 2.5mm;
      justify-content: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="label-grid">
    ${labelsHTML}
  </div>
</body>
</html>`;
}
