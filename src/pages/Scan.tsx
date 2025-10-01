import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { useVoucherStore } from '@/store/voucherStore';
import { preprocessImage, compressImage } from '@/utils/imageProcessing';
import { extractAmount } from '@/utils/amountExtraction';
import { Voucher } from '@/types/voucher';
import { toast } from 'sonner';

export default function Scan() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const { addVoucher } = useVoucherStore();

  const processImage = async (blob: Blob) => {
    setIsProcessing(true);
    setProgress(10);
    setStatusText('معالجة الصورة / Processing image...');

    try {
      // Compress image for storage
      setProgress(20);
      const compressed = await compressImage(blob);
      const imageUrl = URL.createObjectURL(compressed);

      // Preprocess for OCR
      setProgress(40);
      setStatusText('تحسين الصورة / Enhancing image...');
      const preprocessed = await preprocessImage(blob);

      // OCR with Tesseract
      setProgress(60);
      setStatusText('قراءة النص / Reading text...');
      
      const ocrText = await performOCR(preprocessed);

      // Extract amount
      setProgress(80);
      setStatusText('استخراج المبلغ / Extracting amount...');
      const extracted = extractAmount(ocrText);

      // Create voucher
      const voucher: Voucher = {
        id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        imageUrl,
        imageBlob: compressed,
        amount: extracted.amount,
        currency: extracted.currency,
        confidence: extracted.confidence,
        rawText: extracted.rawText,
        detectedRows: extracted.detectedRows,
        createdAt: Date.now(),
        editedManually: false,
      };

      await addVoucher(voucher);
      
      setProgress(100);
      setStatusText('تم! / Done!');

      if (extracted.amount === null) {
        toast.error('لم يُعثر على المبلغ — يُرجى التعديل يدويًا / No amount found — please edit manually');
      } else if (extracted.confidence < 0.75) {
        toast.warning('ثقة منخفضة — يُرجى المراجعة / Low confidence — please review');
      } else {
        toast.success('تم مسح الفاتورة بنجاح / Voucher scanned successfully');
      }

      setTimeout(() => {
        navigate('/review');
      }, 500);

    } catch (error) {
      console.error('Processing error:', error);
      toast.error('فشل معالجة الصورة / Failed to process image');
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const performOCR = async (imageData: string): Promise<string> => {
    // Create a Web Worker for OCR
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/ocr.worker.ts', import.meta.url),
        { type: 'module' }
      );

      const timeoutId = setTimeout(() => {
        worker.terminate();
        reject(new Error('OCR timeout'));
      }, 30000); // 30s timeout

      worker.onmessage = (e) => {
        const { type, text, progress: prog, error } = e.data;

        if (type === 'progress' && prog !== undefined) {
          // Map OCR progress to our 60-80 range
          setProgress(60 + prog * 20);
        } else if (type === 'result') {
          clearTimeout(timeoutId);
          worker.terminate();
          resolve(text);
        } else if (type === 'error') {
          clearTimeout(timeoutId);
          worker.terminate();
          reject(new Error(error));
        }
      };

      worker.onerror = (error) => {
        clearTimeout(timeoutId);
        worker.terminate();
        reject(error);
      };

      worker.postMessage({
        type: 'recognize',
        imageData,
        id: Date.now(),
      });
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={(blob) => {
          setShowCamera(false);
          processImage(blob);
        }}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              size="icon"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">مسح فاتورة / Scan Voucher</h1>
            </div>
          </div>

          {/* Processing State */}
          {isProcessing ? (
            <Card className="p-8 space-y-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                </div>
                <p className="text-lg font-medium">{statusText}</p>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {progress}%
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Camera Option */}
              <Card
                className="p-8 cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary"
                onClick={() => setShowCamera(true)}
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <Camera className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">
                      استخدم الكاميرا / Use Camera
                    </h3>
                    <p className="text-muted-foreground">
                      التقط صورة للفاتورة / Take a photo of the voucher
                    </p>
                  </div>
                </div>
              </Card>

              {/* Upload Option */}
              <Card
                className="p-8 cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center flex-shrink-0">
                    <Upload className="h-8 w-8 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">
                      رفع صورة / Upload Image
                    </h3>
                    <p className="text-muted-foreground">
                      اختر صورة من جهازك / Choose an image from your device
                    </p>
                  </div>
                </div>
              </Card>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}

          {/* Tips */}
          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-3">نصائح للحصول على أفضل النتائج / Tips for best results:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• تأكد من الإضاءة الجيدة / Ensure good lighting</li>
              <li>• اجعل الفاتورة مسطحة ومستقيمة / Keep voucher flat and straight</li>
              <li>• تأكد من وضوح الأرقام / Ensure numbers are clearly visible</li>
              <li>• تجنب الظلال والانعكاسات / Avoid shadows and reflections</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
