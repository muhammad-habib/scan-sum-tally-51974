import { useState } from 'react';
import { Voucher } from '@/types/voucher';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit2, Check, X, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/numberParser';
import { cn } from '@/lib/utils';

interface VoucherCardProps {
  voucher: Voucher;
  selected: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Voucher>) => void;
}

export function VoucherCard({ voucher, selected, onToggle, onUpdate }: VoucherCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(voucher.amount?.toString() || '');
  const [editCurrency, setEditCurrency] = useState(voucher.currency);

  const handleSave = () => {
    const newAmount = parseFloat(editAmount);
    if (!isNaN(newAmount)) {
      onUpdate({
        amount: newAmount,
        currency: editCurrency,
        editedManually: true,
        confidence: 1.0,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditAmount(voucher.amount?.toString() || '');
    setEditCurrency(voucher.currency);
    setIsEditing(false);
  };

  const confidenceColor = voucher.confidence >= 0.75
    ? 'success'
    : voucher.confidence >= 0.5
    ? 'warning'
    : 'destructive';

  return (
    <Card
      className={cn(
        'p-4 transition-all',
        selected && 'ring-2 ring-primary shadow-md',
        voucher.confidence < 0.75 && 'border-warning'
      )}
    >
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            disabled={voucher.amount === null}
          />
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <img
            src={voucher.imageUrl}
            alt="Voucher"
            className="w-20 h-20 object-cover rounded border border-border"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Amount */}
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-foreground">
                {voucher.amount !== null
                  ? formatCurrency(voucher.amount, voucher.currency)
                  : 'لم يُعثر على المبلغ / No amount found'}
              </p>
              <Button
                onClick={() => setIsEditing(true)}
                size="icon"
                variant="ghost"
                className="h-8 w-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-32"
                step="0.01"
              />
              <Input
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="w-20"
                placeholder="EUR"
              />
              <Button
                onClick={handleSave}
                size="icon"
                variant="default"
                className="h-8 w-8"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCancel}
                size="icon"
                variant="ghost"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Confidence Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={confidenceColor === 'success' ? 'default' : 'secondary'}>
              {voucher.editedManually ? (
                'تم التعديل يدويًا / Edited'
              ) : (
                `ثقة ${(voucher.confidence * 100).toFixed(0)}% / ${(voucher.confidence * 100).toFixed(0)}% confidence`
              )}
            </Badge>
            
            {voucher.confidence < 0.75 && !voucher.editedManually && (
              <div className="flex items-center gap-1 text-xs text-warning">
                <AlertCircle className="h-3 w-3" />
                <span>يُرجى المراجعة / Please review</span>
              </div>
            )}
          </div>

          {/* Date */}
          <p className="text-xs text-muted-foreground">
            {new Date(voucher.createdAt).toLocaleString('ar-EG', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        </div>
      </div>
    </Card>
  );
}
