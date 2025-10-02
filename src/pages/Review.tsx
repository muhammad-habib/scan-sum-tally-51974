import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Sparkles, Brain, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VoucherList } from '@/components/voucher/VoucherList';
import { TotalsDisplay } from '@/components/totals/TotalsDisplay';
import { useVoucherStore } from '@/store/voucherStore';
import { toast } from 'sonner';

export default function Review() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loadVouchers, vouchers, selectedIds } = useVoucherStore();

  // Check if we came from scan and show method used
  const fromScan = location.state?.fromScan;
  const scanMethod = location.state?.method;

  useEffect(() => {
    loadVouchers();

    // Show welcome message if coming from scan
    if (fromScan && scanMethod) {
      const methodMessages = {
        'ai-enhanced': '🤖 AI enhancement was used for better accuracy!',
        'traditional': '📋 Traditional OCR method was used.'
      };

      toast.success(methodMessages[scanMethod as keyof typeof methodMessages] || 'Voucher scanned successfully!');
    }
  }, [loadVouchers, fromScan, scanMethod]);

  // Get the latest voucher to show AI analysis
  const latestVoucher = vouchers.length > 0 ? vouchers[vouchers.length - 1] : null;
  const hasAIAnalysis = latestVoucher?.aiAnalysis && latestVoucher?.method !== 'traditional';

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
