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

          {/* AI Analysis Display for Latest Voucher */}
          {hasAIAnalysis && latestVoucher && (
            <Card className="p-6 border-blue-200 bg-blue-50">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">
                    AI Analysis Results / نتائج التحليل بالذكاء الاصطناعي
                  </h3>
                  <Badge variant="secondary" className="ml-auto">
                    {latestVoucher.method === 'ai-vision' && <><Eye className="w-3 h-3 mr-1" />Vision</>}
                    {latestVoucher.method === 'ai-ocr' && <><Brain className="w-3 h-3 mr-1" />OCR+AI</>}
                    {latestVoucher.method === 'hybrid' && <><Zap className="w-3 h-3 mr-1" />Hybrid</>}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Extracted Information</h4>
                    <div className="text-sm space-y-1">
                      <p><span className="font-medium">Amount:</span> {latestVoucher.amount} {latestVoucher.currency}</p>
                      <p><span className="font-medium">Confidence:</span> {Math.round(latestVoucher.confidence * 100)}%</p>
                      {latestVoucher.aiAnalysis?.vendor && (
                        <p><span className="font-medium">Vendor:</span> {latestVoucher.aiAnalysis.vendor}</p>
                      )}
                      {latestVoucher.aiAnalysis?.date && (
                        <p><span className="font-medium">Date:</span> {latestVoucher.aiAnalysis.date}</p>
                      )}
                    </div>
                  </div>

                  {latestVoucher.aiAnalysis?.lineItems && latestVoucher.aiAnalysis.lineItems.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Line Items</h4>
                      <div className="text-sm space-y-1 max-h-24 overflow-y-auto">
                        {latestVoucher.aiAnalysis.lineItems.slice(0, 3).map((item, index) => (
                          <p key={index} className="text-xs">
                            {item.description}: {item.quantity} × {item.unitPrice} = {item.total}
                          </p>
                        ))}
                        {latestVoucher.aiAnalysis.lineItems.length > 3 && (
                          <p className="text-xs text-gray-500">...and {latestVoucher.aiAnalysis.lineItems.length - 3} more items</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {latestVoucher.aiAnalysis?.aiReasoning && (
                  <div className="mt-4 p-3 bg-white rounded border">
                    <h4 className="font-medium text-gray-900 mb-2">AI Reasoning</h4>
                    <p className="text-sm text-gray-700">{latestVoucher.aiAnalysis.aiReasoning}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

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
