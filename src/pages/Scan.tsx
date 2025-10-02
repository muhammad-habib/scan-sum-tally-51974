import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ArrowLeft, Loader2, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { useVoucherStore } from '@/store/voucherStore';
import { preprocessImage, compressImage } from '@/utils/imageProcessing';
import { extractAmountWithAI } from '@/utils/amountExtraction';
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

  // AI is now mandatory - always enabled with Gemini
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [aiModel, setAiModel] = useState(localStorage.getItem('gemini_model') || 'gemini-2.5-flash-lite');

  const { addVoucher } = useVoucherStore();

  const processImage = async (blob: Blob) => {
    // Check if Gemini is configured before processing
    if (!aiApiKey) {
      toast.error('🤖 Gemini API Key required! Please configure AI settings first.');
      setShowAISettings(true);
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

      // Preprocess for OCR (minimal, mainly for AI OCR enhancement)
      setProgress(30);
      setStatusText('تحسين الصورة / Enhancing image...');
      const preprocessed = await preprocessImage(blob);

      // Quick OCR for AI enhancement (reduced priority)
      setProgress(40);
      setStatusText('قراءة نص أساسية / Basic text reading...');
      const ocrText = await performOCR(preprocessed);

      // Gemini AI-First Analysis
      setProgress(50);
      setStatusText('🤖 تحليل بـ Gemini / Gemini AI Analysis...');

      const extracted = await extractAmountWithAI(ocrText, blob, {
        apiKey: aiApiKey,
        model: aiModel,
        maxTokens: 1000
      });

      // Show Gemini method used with enhanced feedback
      const methodEmoji = {
        'ai-vision': '👁️ Gemini Vision',
        'ai-ocr': '🧠 Gemini OCR+',
        'hybrid': '🤝 Gemini Hybrid',
        'traditional': '⚠️ Fallback'
      };

      if (extracted.method === 'traditional') {
        // Check if it's a quota/rate limit issue
        if (extracted.rawText?.includes('quota') || extracted.rawText?.includes('limit')) {
          toast.error('💳 Gemini API Issue', {
            description: 'Please check your Google AI quota or wait a moment and try again.'
          });
        } else {
          toast.error(`${methodEmoji[extracted.method]} - Gemini analysis failed, using basic fallback`, {
            description: `Result: ${extracted.amount} ${extracted.currency} - Consider checking your API key`
          });
        }
      } else {
        toast.success(`${methodEmoji[extracted.method]} - Successfully analyzed with Gemini`, {
          description: `${extracted.amount} ${extracted.currency} (${Math.round(extracted.confidence * 100)}% confidence)`
        });
      }

      if (extracted.aiAnalysis?.aiReasoning) {
        console.log('🤖 Gemini Reasoning:', extracted.aiAnalysis.aiReasoning);
      }

      // Create voucher with Gemini metadata
      const voucher: Voucher = {
        id: Date.now().toString(),
        amount: extracted.amount || 0,
        currency: extracted.currency,
        date: new Date().toISOString().split('T')[0],
        description: `Gemini-Scanned voucher (${extracted.method})`,
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
            method: 'gemini-powered'
          }
        });
      }, 500);

    } catch (error) {
      console.error('Gemini Processing failed:', error);
      toast.error('🤖 فشل في التحليل بـ Gemini / Gemini Analysis failed');
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
    if (!aiApiKey.trim()) {
      toast.error('Please enter a valid Gemini API key');
      return;
    }

    localStorage.setItem('gemini_api_key', aiApiKey);
    localStorage.setItem('gemini_model', aiModel);
    toast.success('🤖 Gemini settings saved successfully!');
    setShowAISettings(false);
  };

  // Force AI settings if no API key
  const needsAISetup = !aiApiKey;

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
        {(showAISettings || needsAISetup) && (
          <Card className="p-4 mb-6 border-blue-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Gemini AI Configuration (Required)</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Google AI API Key *</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="AIza..."
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  className={!aiApiKey ? 'border-red-300' : ''}
                />
                <p className="text-xs text-gray-600">
                  Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" className="text-blue-600 underline">Google AI Studio</a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Gemini Model</Label>
                <select
                  id="model"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Best for Arabic)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                </select>
                <p className="text-xs text-gray-600">
                  Gemini 2.5 Flash Lite is optimized for fast, accurate Arabic text analysis
                </p>
              </div>

              <Button onClick={saveAISettings} className="w-full">
                💾 Save Gemini Configuration
              </Button>
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
