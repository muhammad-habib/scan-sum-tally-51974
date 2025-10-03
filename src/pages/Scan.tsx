import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { useVoucherStore } from '@/store/voucherStore';
import { preprocessImage, compressImage } from '@/utils/imageProcessing';
import { extractAmountWithAI } from '@/utils/amountExtraction';
import { Voucher } from '@/types/voucher';
import { toast } from 'sonner';
import { getApiKey, hasApiKey } from '@/utils/config';

export default function Scan() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const { addVoucher } = useVoucherStore();

  // Check if API key is configured
  const apiKeyAvailable = hasApiKey();

  const processImage = async (blob: Blob) => {
    // Check if API key is configured
    if (!apiKeyAvailable) {
      toast.error('🤖 API Key not configured. Please contact the administrator.');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setStatusText('معالجة الصورة / Processing image...');

    try {
      // Compress image for storage
      setProgress(20);
      const compressed = await compressImage(blob);
      const imageUrl = URL.createObjectURL(compressed);

      // Preprocess for OCR
      setProgress(30);
      setStatusText('تحسين الصورة / Enhancing image...');
      const preprocessed = await preprocessImage(blob);

      // Quick OCR for AI enhancement
      setProgress(40);
      setStatusText('قراءة نص أساسية / Basic text reading...');
      const ocrText = await performOCR(preprocessed);

      // Gemini AI Analysis
      setProgress(50);
      setStatusText('🤖 تحليل بـ Gemini / Gemini AI Analysis...');

      const extracted = await extractAmountWithAI(ocrText, blob, {
        apiKey: getApiKey() || '',
        model: 'gemini-2.5-flash-lite',
        maxTokens: 1000
      });

      // Show analysis results
      const methodEmoji = {
        'ai-vision': '👁️ Gemini Vision',
        'ai-ocr': '🧠 Gemini OCR+',
        'hybrid': '🤝 Gemini Hybrid',
        'traditional': '⚠️ Fallback'
      };

      if (extracted.method === 'traditional') {
        if (extracted.rawText?.includes('quota') || extracted.rawText?.includes('limit')) {
          toast.error('💳 Gemini API Issue', {
            description: 'API quota exceeded. Please try again later.'
          });
        } else {
          toast.error(`${methodEmoji[extracted.method]} - Gemini analysis failed`, {
            description: `Result: ${extracted.amount} ${extracted.currency}`
          });
        }
      } else {
        toast.success(`${methodEmoji[extracted.method]} - Successfully analyzed`, {
          description: `${extracted.amount} ${extracted.currency} (${Math.round(extracted.confidence * 100)}% confidence)`
        });
      }

      if (extracted.aiAnalysis?.aiReasoning) {
        console.log('🤖 Gemini Reasoning:', extracted.aiAnalysis.aiReasoning);
      }

      // Create voucher
      const voucher: Voucher = {
        id: Date.now().toString(),
        amount: extracted.amount || 0,
        currency: extracted.currency,
        date: new Date().toISOString().split('T')[0],
        description: `AI-Scanned voucher (${extracted.method})`,
        confidence: extracted.confidence,
        imageUrl,
        ocrText,
        rawText: extracted.rawText,
        method: extracted.method,
        aiAnalysis: extracted.aiAnalysis,
        createdAt: Date.now()
      };

      addVoucher(voucher);

      setProgress(100);
      setStatusText('مكتمل / Complete!');

      setTimeout(() => {
        navigate('/review', {
          state: {
            fromScan: true,
            method: 'ai-powered'
          }
        });
      }, 500);

    } catch (error) {
      console.error('Processing failed:', error);
      toast.error('🤖 فشل في التحليل / Analysis failed');
      setIsProcessing(false);
      setProgress(0);
      setStatusText('');
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

  // Show API key not configured message
  if (!apiKeyAvailable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900">🤖 AI Scan</h1>
            <div></div>
          </div>

          <Card className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-600 mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">
              API Key Not Configured
            </h3>
            <p className="text-gray-600 mb-4">
              The Gemini AI API key has not been configured for this deployment.
              Please contact the administrator to set up the API key in GitHub Secrets.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              Return to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">
              🤖 مسح ذكي / AI Scan
            </h1>
          </div>

          <div className="w-10"></div>
        </div>

        {/* Status Display */}
        {isProcessing && (
          <Card className="p-6 mb-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">{statusText}</p>
                <Progress value={progress} className="mt-2" />
                <p className="text-sm text-gray-500 mt-1">{progress}%</p>
              </div>
            </div>
          </Card>
        )}

        {/* Scan Options */}
        {!showCamera && !isProcessing && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="text-center space-y-4">
                <Camera className="h-12 w-12 mx-auto text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    التقط صورة / Take Photo
                  </h3>
                  <p className="text-sm text-gray-500">
                    استخدم الكاميرا لمسح الإيصال / Use camera to scan receipt
                  </p>
                </div>
                <Button
                  onClick={() => setShowCamera(true)}
                  className="w-full"
                  disabled={isProcessing}
                >
                  فتح الكاميرا / Open Camera
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-center space-y-4">
                <Upload className="h-12 w-12 mx-auto text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    رفع صورة / Upload Image
                  </h3>
                  <p className="text-sm text-gray-500">
                    اختر صورة من الاستوديو / Choose image from gallery
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                  disabled={isProcessing}
                >
                  اختيار صورة / Choose Image
                </Button>
              </div>
            </Card>

          </div>
        )}

        {/* Camera Component */}
        {showCamera && (
          <CameraCapture
            onCapture={processImage}
            onClose={() => setShowCamera(false)}
          />
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              processImage(file);
            }
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}
