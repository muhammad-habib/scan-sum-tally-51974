import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ArrowLeft, Loader2, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { useVoucherStore } from '@/store/voucherStore';
import { preprocessImage, compressImage } from '@/utils/imageProcessing';
import { extractAmount, extractAmountWithAI } from '@/utils/amountExtraction';
import { Voucher } from '@/types/voucher';
import { toast } from 'sonner';

export default function Scan() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // AI Configuration
  const [useAI, setUseAI] = useState(false);
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [aiModel, setAiModel] = useState('gpt-4');

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

      // Extract amount with AI enhancement if enabled
      setProgress(80);
      if (useAI && aiApiKey) {
        setStatusText('تحليل بالذكاء الاصطناعي / AI Analysis...');
        const extracted = await extractAmountWithAI(ocrText, blob, {
          apiKey: aiApiKey,
          model: aiModel,
          maxTokens: 1000
        });

        // Show AI method used
        const methodEmoji = {
          'ai-vision': '👁️',
          'ai-ocr': '🤖',
          'hybrid': '🤝',
          'traditional': '📋'
        };

        toast.success(`${methodEmoji[extracted.method]} Amount extracted using ${extracted.method} method`, {
          description: `${extracted.amount} ${extracted.currency} (${Math.round(extracted.confidence * 100)}% confidence)`
        });

        if (extracted.aiAnalysis?.aiReasoning) {
          console.log('AI Reasoning:', extracted.aiAnalysis.aiReasoning);
        }

        // Create voucher with AI metadata
        const voucher: Voucher = {
          id: Date.now().toString(),
          amount: extracted.amount || 0,
          currency: extracted.currency,
          date: new Date().toISOString().split('T')[0],
          description: `Scanned voucher (${extracted.method})`,
          confidence: extracted.confidence,
          imageUrl,
          ocrText,
          rawText: extracted.rawText,
          method: extracted.method,
          aiAnalysis: extracted.aiAnalysis,
          createdAt: Date.now() // Fix: Add missing createdAt field
        };

        addVoucher(voucher);
      } else {
        setStatusText('استخراج المبلغ / Extracting amount...');
        const extracted = extractAmount(ocrText);

        // Create voucher with traditional method
        const voucher: Voucher = {
          id: Date.now().toString(),
          amount: extracted.amount || 0,
          currency: extracted.currency,
          date: new Date().toISOString().split('T')[0],
          description: 'Scanned voucher (traditional)',
          confidence: extracted.confidence,
          imageUrl,
          ocrText,
          rawText: extracted.rawText,
          method: 'traditional',
          createdAt: Date.now() // Fix: Add missing createdAt field
        };

        addVoucher(voucher);
      }

      setProgress(100);
      setStatusText('مكتمل / Complete!');

      setTimeout(() => {
        navigate('/review', {
          state: {
            fromScan: true,
            method: useAI ? 'ai-enhanced' : 'traditional'
          }
        });
      }, 500);

    } catch (error) {
      console.error('Processing failed:', error);
      toast.error('فشل في معالجة الصورة / Failed to process image');
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

  const saveAISettings = () => {
    if (aiApiKey) {
      localStorage.setItem('openai_api_key', aiApiKey);
      toast.success('AI settings saved');
    }
    setShowAISettings(false);
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

          <h1 className="text-xl font-bold text-gray-900">
            مسح الإيصال / Scan Receipt
          </h1>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAISettings(!showAISettings)}
            className="rounded-full"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* AI Settings Panel */}
        {showAISettings && (
          <Card className="p-4 mb-6 border-blue-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <Label htmlFor="ai-toggle">AI Enhancement</Label>
                </div>
                <Switch
                  id="ai-toggle"
                  checked={useAI}
                  onCheckedChange={setUseAI}
                />
              </div>

              {useAI && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="api-key">OpenAI API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="sk-..."
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <select
                      id="model"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="gpt-4">GPT-4 (Recommended)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>

                  <Button onClick={saveAISettings} className="w-full">
                    Save AI Settings
                  </Button>
                </>
              )}
            </div>
          </Card>
        )}

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
                  {useAI && (
                    <div className="flex items-center justify-center mt-2 text-blue-600">
                      <Sparkles className="h-4 w-4 mr-1" />
                      <span className="text-xs">AI Enhanced</span>
                    </div>
                  )}
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
                  {useAI && (
                    <div className="flex items-center justify-center mt-2 text-blue-600">
                      <Sparkles className="h-4 w-4 mr-1" />
                      <span className="text-xs">AI Enhanced</span>
                    </div>
                  )}
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
