import { Voucher } from '@/types/voucher';

/**
 * Export vouchers to CSV format
 */
export function exportToCSV(vouchers: Voucher[]): string {
  const headers = ['ID', 'Amount', 'Currency', 'Confidence', 'Date', 'Manually Edited'];
  const rows = vouchers.map(v => [
    v.id,
    v.amount?.toFixed(2) || 'N/A',
    v.currency,
    v.confidence.toFixed(2),
    new Date(v.createdAt).toISOString(),
    v.editedManually ? 'Yes' : 'No',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(vouchers: Voucher[], filename = 'vouchers.csv'): void {
  const csv = exportToCSV(vouchers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
