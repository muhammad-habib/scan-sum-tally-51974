/**
 * Preprocess image for better OCR accuracy
 */
export async function preprocessImage(imageBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Set canvas size (limit max dimension for performance)
        const maxDimension = 2048;
        let { width, height } = img;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original image
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Enhanced preprocessing for better OCR
        // 1. Convert to grayscale
        // 2. Apply adaptive-like contrast enhancement
        // 3. Denoise
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale using luminosity method
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Adaptive contrast enhancement (localized)
          // Use gamma correction for better results than hard threshold
          const normalized = gray / 255;
          const gamma = 1.2; // Slightly enhance contrast
          const enhanced = Math.pow(normalized, 1 / gamma) * 255;
          
          // Apply slight sharpening by increasing contrast
          const contrast = 1.3;
          let value = ((enhanced - 128) * contrast) + 128;
          
          // Clamp values
          value = Math.max(0, Math.min(255, value));
          
          data[i] = value;     // R
          data[i + 1] = value; // G
          data[i + 2] = value; // B
          // Alpha stays the same
        }

        // Put processed image back
        ctx.putImageData(imageData, 0, 0);

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Compress image for storage
 */
export async function compressImage(blob: Blob, maxSizeMB = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Calculate new dimensions
        let { width, height } = img;
        const maxDimension = 1024;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (compressedBlob) => {
            URL.revokeObjectURL(url);
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          0.8
        );
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
