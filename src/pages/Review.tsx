import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoucherList } from '@/components/voucher/VoucherList';
import { TotalsDisplay } from '@/components/totals/TotalsDisplay';
import { useVoucherStore } from '@/store/voucherStore';

export default function Review() {
  const navigate = useNavigate();
  const { loadVouchers, vouchers, selectedIds } = useVoucherStore();

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                size="icon"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  مراجعة الفواتير / Review Vouchers
                </h1>
                <p className="text-sm text-muted-foreground">
                  {vouchers.length} فواتير / vouchers total
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigate('/scan')}
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              إضافة / Add
            </Button>
          </div>

          {/* Totals Section */}
          {selectedIds.size > 0 && (
            <div className="sticky top-4 z-10">
              <TotalsDisplay />
            </div>
          )}

          {/* Vouchers List */}
          <VoucherList />
        </div>
      </div>
    </div>
  );
}
