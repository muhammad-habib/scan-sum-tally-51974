import { useVoucherStore } from '@/store/voucherStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/numberParser';
import { copyToClipboard, downloadCSV } from '@/utils/exportUtils';
import { toast } from 'sonner';

export function TotalsDisplay() {
  const { getSelectedVouchers, calculateTotals } = useVoucherStore();
  const selected = getSelectedVouchers();
  const totals = calculateTotals();

  const handleCopy = async () => {
    if (totals.overallTotal !== null) {
      const text = `${formatCurrency(totals.overallTotal, totals.totalByCurrency[0].currency)}`;
      const success = await copyToClipboard(text);
      if (success) {
        toast.success('تم النسخ / Copied to clipboard');
      }
    }
  };

  const handleExport = () => {
    downloadCSV(selected);
    toast.success('تم التصدير / Exported to CSV');
  };

  if (selected.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          اختر فواتير لحساب الإجمالي / Select vouchers to calculate total
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {/* Grand Total */}
      {totals.singleCurrency && totals.overallTotal !== null ? (
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground font-medium">
            الإجمالي الكلي / Grand Total
          </p>
          <p className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {formatCurrency(totals.overallTotal, totals.totalByCurrency[0].currency)}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-success">
            <CheckCircle className="h-4 w-4" />
            <span>{selected.length} فواتير / vouchers</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-medium text-center">
            الإجمالي حسب العملة / Total by Currency
          </p>
          {totals.totalByCurrency.map((ct) => (
            <div key={ct.currency} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
              <span className="text-sm text-muted-foreground">
                {ct.currency} ({ct.count} فواتير / vouchers)
              </span>
              <span className="text-2xl font-bold">
                {formatCurrency(ct.total, ct.currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleCopy}
          className="flex-1 gap-2"
          variant="default"
          disabled={!totals.singleCurrency || totals.overallTotal === null}
        >
          <Copy className="h-4 w-4" />
          نسخ / Copy Total
        </Button>
        
        <Button
          onClick={handleExport}
          className="flex-1 gap-2"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          تصدير CSV / Export CSV
        </Button>
      </div>
    </Card>
  );
}
