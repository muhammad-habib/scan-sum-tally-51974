import { useRef, useState, useEffect } from 'react';
import { Camera, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('لا يمكن الوصول إلى الكاميرا / Cannot access camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCaptured(dataUrl);
  };

  const confirmCapture = () => {
    if (!captured || !canvasRef.current) return;
    
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        onCapture(blob);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const retake = () => {
    setCaptured(null);
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={onClose} variant="outline">إغلاق / Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative w-full h-full">
        {/* Video/Captured Preview */}
        {!captured ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={captured}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          {!captured ? (
            <div className="flex items-center justify-between">
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>

              <Button
                onClick={capturePhoto}
                size="lg"
                className="h-16 w-16 rounded-full bg-white hover:bg-white/90"
              >
                <Camera className="h-8 w-8 text-primary" />
              </Button>

              <div className="w-12" /> {/* Spacer */}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={retake}
                variant="outline"
                size="lg"
                className="bg-white/10 border-white text-white hover:bg-white/20"
              >
                <X className="h-5 w-5 mr-2" />
                إعادة / Retake
              </Button>
              
              <Button
                onClick={confirmCapture}
                size="lg"
                className="bg-success hover:bg-success/90"
              >
                <Check className="h-5 w-5 mr-2" />
                تأكيد / Confirm
              </Button>
            </div>
          )}
        </div>

        {/* Guidance overlay */}
        {!captured && (
          <div className="absolute top-6 left-0 right-0 px-6">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 text-center text-white">
              <p className="font-medium">ضع الفاتورة في الإطار</p>
              <p className="text-sm text-white/80 mt-1">Position voucher in frame</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
