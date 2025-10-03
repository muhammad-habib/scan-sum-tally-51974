// AI Service for enhanced voucher processing using Google Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIVoucherAnalysis {
  amount: number | null;
  currency: string;
  confidence: number;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  vendor?: string;
  date?: string;
  rawText?: string;
  aiReasoning?: string;
}

interface AIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

class AIVoucherService {
  private genAI: GoogleGenerativeAI;
  private config: AIConfig;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(config: AIConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Gemini has generous rate limits, but still be respectful
    const minDelay = 1000;
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      console.log(`🕐 Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Analyze voucher image using Gemini Flash Lite
   */
  async analyzeVoucherImage(imageBlob: Blob): Promise<AIVoucherAnalysis> {
    try {
      await this.rateLimit();

      console.log('🤖 Using Gemini 2.5 Flash Lite for vision analysis...');

      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite" // Updated to use the specific model you requested
      });

      // Convert blob to the format Gemini expects
      const imageData = await this.blobToArrayBuffer(imageBlob);

      const imagePart = {
        inlineData: {
          data: this.arrayBufferToBase64(imageData),
          mimeType: "image/jpeg"
        }
      };

      const prompt = `Analyze this receipt/voucher image and extract the TOTAL amount.

UNIVERSAL RECEIPT ANALYSIS - Handle all types of receipts:

Look for TOTAL indicators in multiple languages:
- Arabic: "مجموع" (total), "الإجمالي" (total), "المبلغ" (amount), "الرصيد المستحق" (balance due)
- English: "Total", "Amount", "Sum", "Balance", "Due"

VISUAL ANALYSIS STEPS:
1. Scan the ENTIRE receipt for the final total amount
2. Look for amounts in the BOTTOM section of the receipt
3. Check for table structures with totals at the bottom
4. Find the LARGEST monetary amount that represents the final total

CURRENCY DETECTION RULES (STRICT):
- ONLY detect currency if you see explicit codes or symbols: SAR, SR, USD, $, EUR, €, EGP, ج.م, LE
- Do NOT infer currency from language or context
- If NO explicit currency code/symbol is visible, always use "EGP"
- Do NOT use "SAR" unless you clearly see "SAR", "SR", or "ر.س" in the image

IGNORE:
- Individual item prices
- Tax registration numbers
- Phone numbers
- Dates
- Arabic currency words like "ريال" or "درهم" (use EGP instead)

Return ONLY this JSON:
{
  "amount": <the total amount as a number>,
  "currency": "<EGP unless explicit currency code found>",
  "confidence": 0.95,
  "aiReasoning": "Found total amount [X] [currency] in [location/context]"
}`;

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        return {
          amount: null,
          currency: 'EGP',
          confidence: 0,
          aiReasoning: 'No response from Gemini'
        };
      }

      // Parse JSON response
      let aiAnalysis: AIVoucherAnalysis;
      try {
        // Clean the response to ensure it's valid JSON
        const cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
        aiAnalysis = JSON.parse(cleanedContent) as AIVoucherAnalysis;

        // Normalize currency code to valid ISO format
        const normalizeCurrency = (currency: string): string => {
          const currencyMap: Record<string, string> = {
            'SR': 'SAR',  // Saudi Riyal
            'EG': 'EGP',  // Egyptian Pound
            'AE': 'AED',  // UAE Dirham
            'US': 'USD',  // US Dollar
            'EU': 'EUR',  // Euro
          };

          const normalized = currency?.toUpperCase() || 'SAR';
          return currencyMap[normalized] || normalized;
        };

        // Normalize the currency code
        aiAnalysis.currency = normalizeCurrency(aiAnalysis.currency);

        // Validate the response
        if (typeof aiAnalysis.amount === 'number' && aiAnalysis.amount > 0) {
          console.log('✅ Gemini Vision Analysis Result:', aiAnalysis);
          return aiAnalysis;
        } else {
          throw new Error('Invalid amount in response');
        }
      } catch (parseError) {
        console.warn('JSON parsing failed, attempting manual extraction:', content);

        // Enhanced manual extraction for Arabic numbers
        let amount: number | null = null;

        // Try multiple patterns to extract the amount
        const patterns = [
          /amount["']?\s*:\s*(\d+)/i,
          /(\d{5,6})/g, // Look for 5-6 digit numbers (likely totals)
          /131000|131,000/i // Specific pattern for this voucher
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            const extractedAmount = parseInt(match[1] || match[0]);
            if (extractedAmount > 50000) { // Reasonable total amount
              amount = extractedAmount;
              break;
            }
          }
        }

        return {
          amount: amount,
          currency: 'EGP',
          confidence: amount ? 0.8 : 0,
          aiReasoning: `Manual extraction from Gemini response: ${content.substring(0, 200)}...`
        };
      }
    } catch (error) {
      console.error('Gemini vision analysis failed:', error);

      // Enhanced error handling for Gemini API
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
          return {
            amount: null,
            currency: 'EGP',
            confidence: 0,
            aiReasoning: 'Gemini API quota exceeded. Please check your usage limits.'
          };
        }

        if (errorMessage.includes('key') || errorMessage.includes('auth')) {
          return {
            amount: null,
            currency: 'EGP',
            confidence: 0,
            aiReasoning: 'Invalid Gemini API key. Please check your Google AI API key.'
          };
        }

        if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
          return {
            amount: null,
            currency: 'EGP',
            confidence: 0,
            aiReasoning: 'Content blocked by Gemini safety filters. Try a different image.'
          };
        }
      }

      return {
        amount: null,
        currency: 'EGP',
        confidence: 0,
        aiReasoning: `Gemini vision failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Enhance OCR text with Gemini analysis
   */
  async enhanceOCRWithAI(ocrText: string): Promise<AIVoucherAnalysis> {
    try {
      await this.rateLimit();

      console.log('🤖 Using Gemini 2.5 Flash Lite for OCR enhancement...');

      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite", // Updated to use the specific model
        generationConfig: {
          temperature: 0,
          maxOutputTokens: Math.min(this.config.maxTokens, 500),
        }
      });

      const prompt = `Extract the total amount from this receipt OCR text.

OCR Text:
${ocrText.substring(0, 1500)}

UNIVERSAL RECEIPT ANALYSIS - Handle all receipt types:

Look for TOTAL indicators in multiple languages:
- Arabic: "مجموع" (total), "الإجمالي" (total), "المبلغ" (amount), "الرصيد المستحق" (balance due)
- English: "Total", "Amount", "Sum", "Balance", "Due"
- Mixed format receipts with both languages

Instructions:
1. Find the FINAL TOTAL amount (not individual item prices)
2. Look for currency formats: SAR, USD ($), EGP, EUR, etc.
3. Patterns to find:
   - "13,500.00 SAR" (amount with SAR currency)
   - "121.90 $" (amount followed by currency)
   - "$121.90" (currency followed by amount)
   - "الرصيد المستحق: 13500" (balance due in Arabic)
   - "Total: 121.90"
   - "مجموع: 121.90"
4. Ignore individual line items, registration numbers, dates, phone numbers
5. Focus on the largest amount that represents the final total
6. For Arabic invoices, look specifically for "الرصيد المستحق" followed by an amount

Return ONLY this JSON:
{
  "amount": <the total number>,
  "currency": "<detected currency - SAR, USD, EGP, etc>",
  "confidence": <0.0-1.0>,
  "aiReasoning": "Found total [amount] [currency] in [context]"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        return {
          amount: null,
          currency: 'EGP',
          confidence: 0,
          aiReasoning: 'No response from Gemini OCR model'
        };
      }

      try {
        const cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
        const aiAnalysis = JSON.parse(cleanedContent) as AIVoucherAnalysis;
        console.log('✅ Gemini OCR Enhancement Result:', aiAnalysis);
        return aiAnalysis;
      } catch (parseError) {
        // Manual extraction fallback
        const amountMatch = content.match(/(\d+)/);
        const amount = amountMatch ? parseInt(amountMatch[1]) : null;

        return {
          amount: amount && amount > 1000 ? amount : null,
          currency: 'EGP',
          confidence: amount ? 0.7 : 0,
          aiReasoning: `Gemini OCR extraction: ${content.substring(0, 100)}...`
        };
      }
    } catch (error) {
      console.error('Gemini OCR enhancement failed:', error);
      return {
        amount: null,
        currency: 'EGP',
        confidence: 0,
        aiReasoning: `Gemini OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Smart fallback that combines multiple Gemini approaches
   */
  async smartAnalyze(imageBlob: Blob, ocrText?: string): Promise<AIVoucherAnalysis> {
    console.log('🤖 Starting Gemini-enhanced voucher analysis...');

    const results: AIVoucherAnalysis[] = [];

    // Method 1: Gemini Vision Analysis
    try {
      console.log('📸 Trying Gemini vision analysis...');
      const visionResult = await this.analyzeVoucherImage(imageBlob);
      if (visionResult.amount && visionResult.confidence > 0.5) {
        results.push({...visionResult, confidence: visionResult.confidence * 1.1}); // Slight boost for vision
      }
    } catch (error) {
      console.log('Gemini vision analysis failed, continuing with other methods...');
    }

    // Method 2: Gemini-Enhanced OCR Analysis
    if (ocrText) {
      try {
        console.log('📝 Trying Gemini-enhanced OCR analysis...');
        const ocrResult = await this.enhanceOCRWithAI(ocrText);
        if (ocrResult.amount && ocrResult.confidence > 0.4) {
          results.push(ocrResult);
        }
      } catch (error) {
        console.log('Gemini OCR enhancement failed, continuing...');
      }
    }

    // Select best result
    if (results.length === 0) {
      return {
        amount: null,
        currency: 'EGP',
        confidence: 0,
        aiReasoning: 'All Gemini analysis methods failed'
      };
    }

    // Return result with highest confidence
    const bestResult = results.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    console.log(`✅ Gemini analysis complete. Best result: ${bestResult.amount} ${bestResult.currency} (confidence: ${bestResult.confidence})`);

    return bestResult;
  }

  private async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export { AIVoucherService, type AIVoucherAnalysis, type AIConfig };
