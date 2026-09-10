import type { Product } from '../models/domain.ts';

export interface SalesImportRecord {
  referenceId: string;
  shopId: string;
  fileName: string;
  csv: string;
  rowCount: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedBy: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface CsvProductRow {
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  unit: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  imageUrl?: string;
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      result.push(value.trim()); value = '';
    } else value += char;
  }
  result.push(value.trim());
  return result;
}

export function parseSalesCsv(csv: string): CsvProductRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row');
  const headers = parseCsvLine(lines[0]).map(header => header.toLowerCase().replace(/\s+/g, ''));
  const index = (name: string) => headers.indexOf(name);
  const required = ['sku', 'name', 'category', 'unit', 'mrp', 'sellingprice', 'stock'];
  const missing = required.filter(name => index(name) < 0);
  if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const get = (name: string) => values[index(name)] ?? '';
    const mrp = Number(get('mrp'));
    const sellingPrice = Number(get('sellingprice'));
    const stock = Number(get('stock'));
    const minStock = Number(get('minstock') || '5');
    const row: CsvProductRow = {
      sku: get('sku'), barcode: get('barcode') || undefined, name: get('name'), category: get('category'), unit: get('unit'),
      mrp, sellingPrice, stock, minStock, imageUrl: get('imageurl') || undefined,
    };
    if (!row.sku || !row.name || !row.category || !row.unit || !Number.isFinite(mrp) || mrp < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0 || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(minStock) || minStock < 0) {
      throw new Error(`Invalid product data on CSV row ${rowIndex + 2}`);
    }
    return row;
  });
}

export function productFromCsvRow(row: CsvProductRow, shopId: string): Product {
  return {
    id: `p-${shopId}-${row.sku}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sku: row.sku,
    ...(row.barcode ? { barcode: row.barcode } : {}),
    name: row.name,
    category: row.category,
    unit: row.unit,
    mrp: row.mrp,
    sellingPrice: row.sellingPrice,
    stock: row.stock,
    minStock: row.minStock,
    shopId,
    ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    active: true,
  };
}
