import { useVoucherStore } from '@/store/voucherStore';
import { VoucherCard } from './VoucherCard';
import { Button } from '@/components/ui/button';
import { Trash2, CheckSquare, Square } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function VoucherList() {
  const {
    vouchers,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    updateVoucher,
    deleteVoucher,
  } = useVoucherStore();

  const allSelected = vouchers.length > 0 && selectedIds.size === vouchers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleToggleAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  if (vouchers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          لا توجد فواتير بعد / No vouchers yet
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          ابدأ بمسح فاتورة / Start by scanning a voucher
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handleToggleAll}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {allSelected ? (
            <>
              <CheckSquare className="h-4 w-4" />
              إلغاء التحديد / Deselect All
            </>
          ) : (
            <>
              <Square className="h-4 w-4" />
              تحديد الكل / Select All
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} محددة / selected
          </span>
        </div>
      </div>

      {/* Voucher Cards */}
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="space-y-3 pr-4">
          {vouchers.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              selected={selectedIds.has(voucher.id)}
              onToggle={() => toggleSelection(voucher.id)}
              onUpdate={(updates) => updateVoucher(voucher.id, updates)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
