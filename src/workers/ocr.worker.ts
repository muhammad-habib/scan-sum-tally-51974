import { createWorker } from 'tesseract.js';

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function initWorker() {
  if (!worker) {
    worker = await createWorker(['eng', 'ara', 'deu', 'por'], 1, {
      logger: (m) => {
        // Send progress updates to main thread
        if (m.status === 'recognizing text') {
          self.postMessage({
            type: 'progress',
            progress: m.progress,
          });
        }
      },
    });
  }
  return worker;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, imageData, id } = e.data;

  if (type === 'recognize') {
    try {
      const worker = await initWorker();
      
      self.postMessage({
        type: 'progress',
        id,
        progress: 0,
      });

      const { data } = await worker.recognize(imageData);
      
      self.postMessage({
        type: 'result',
        id,
        text: data.text,
        confidence: data.confidence,
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        id,
        error: error instanceof Error ? error.message : 'OCR failed',
      });
    }
  } else if (type === 'terminate') {
    if (worker) {
      await worker.terminate();
      worker = null;
    }
    self.postMessage({ type: 'terminated' });
  }
};
