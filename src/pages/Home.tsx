import { useState, useEffect } from 'react';
import { Camera, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoucherStore } from '@/store/voucherStore';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const { vouchers, loadVouchers, clearAll } = useVoucherStore();
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const handleClearAll = async () => {
    if (confirm('هل تريد حذف جميع الفواتير؟ / Delete all vouchers?')) {
      setIsClearing(true);
      await clearAll();
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary mb-4">
              <FileText className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ماسح الفواتير
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Voucher Scanner
            </h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              امسح الفواتير واحسب الإجمالي تلقائيًا
            </p>
            <p className="text-muted-foreground">
              Scan vouchers and calculate totals automatically
            </p>
          </div>

          {/* Main CTA */}
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={() => navigate('/scan')}
              size="lg"
              className="w-full max-w-md h-16 text-lg bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg"
            >
              <Camera className="h-6 w-6 mr-3" />
              ابدأ المسح / Start Scanning
            </Button>

            {vouchers.length > 0 && (
              <Button
                onClick={() => navigate('/review')}
                variant="outline"
                size="lg"
                className="w-full max-w-md h-14"
              >
                <FileText className="h-5 w-5 mr-2" />
                عرض الفواتير ({vouchers.length}) / View Vouchers ({vouchers.length})
              </Button>
            )}
          </div>

          {/* Stats */}
          {vouchers.length > 0 && (
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="bg-card p-6 rounded-lg border shadow-sm text-center">
                <p className="text-3xl font-bold text-primary">{vouchers.length}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  فواتير / Vouchers
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border shadow-sm text-center">
                <p className="text-3xl font-bold text-success">
                  {vouchers.filter(v => v.confidence >= 0.75).length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  عالية الثقة / High confidence
                </p>
              </div>
            </div>
          )}

          {/* Clear All */}
          {vouchers.length > 0 && (
            <div className="text-center pt-8">
              <Button
                onClick={handleClearAll}
                variant="ghost"
                size="sm"
                disabled={isClearing}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                حذف الكل / Clear All
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
