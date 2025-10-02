// AI Service for enhanced voucher processing
import OpenAI from 'openai';

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
  private openai: OpenAI;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Only for demo - use server-side in production
    });
  }

  /**
   * Analyze voucher image using AI vision
   */
  async analyzeVoucherImage(imageBlob: Blob): Promise<AIVoucherAnalysis> {
    try {
      // Convert blob to base64
      const base64Image = await this.blobToBase64(imageBlob);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        max_tokens: this.config.maxTokens,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this Arabic/English receipt/voucher image and extract the following information:

1. Total amount (the final total, not individual line items)
2. Currency (EGP, USD, EUR, etc.)
3. Individual line items with descriptions, quantities, unit prices, and totals
4. Vendor/business name
5. Date if visible

Please respond with a JSON object in this exact format:
{
  "amount": number | null,
  "currency": "string",
  "confidence": number (0-1),
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "vendor": "string",
  "date": "string",
  "aiReasoning": "string explaining how you determined the total"
}

For Arabic receipts:
- Look for keywords like "الإجمالي" (total), "المجموع" (sum), or "ألف" (thousands)
- The total is usually in the bottom row or marked with total keywords
- Consider table structure where the rightmost column often contains totals
- Be careful not to confuse individual line items with the final total

Return only the JSON object, no additional text.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse AI response
      const aiAnalysis = JSON.parse(content) as AIVoucherAnalysis;

      console.log('AI Analysis Result:', aiAnalysis);

      return aiAnalysis;
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        amount: null,
        currency: 'EGP',
        confidence: 0,
        aiReasoning: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Enhance OCR text with AI analysis
   */
  async enhanceOCRWithAI(ocrText: string): Promise<AIVoucherAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing Arabic and English receipts/vouchers. Your task is to extract the total amount from OCR text that may contain errors.

Guidelines:
1. Look for Arabic total keywords: الإجمالي، اجمالي، المجموع، مجموع، الكلي
2. Look for English total keywords: total, sum, grand total
3. Look for the pattern "number + ألف" which indicates thousands in Arabic
4. In table structures, the total is usually in the rightmost column of the last row
5. Ignore individual line items, registration numbers, phone numbers, dates
6. The total should be the largest reasonable amount that represents the sum

Return JSON only in this format:
{
  "amount": number | null,
  "currency": "string", 
  "confidence": number (0-1),
  "aiReasoning": "explanation of how you found the total"
}`
          },
          {
            role: "user",
            content: `Analyze this OCR text from an Arabic/English receipt and find the total amount:\n\n${ocrText}`
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const aiAnalysis = JSON.parse(content) as AIVoucherAnalysis;

      console.log('AI OCR Enhancement Result:', aiAnalysis);

      return aiAnalysis;
    } catch (error) {
      console.error('AI OCR enhancement failed:', error);
      return {
        amount: null,
        currency: 'EGP',
        confidence: 0,
        aiReasoning: `AI enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Smart fallback that combines multiple AI approaches
   */
  async smartAnalyze(imageBlob: Blob, ocrText?: string): Promise<AIVoucherAnalysis> {
    console.log('🤖 Starting AI-enhanced voucher analysis...');

    const results: AIVoucherAnalysis[] = [];

    // Method 1: AI Vision Analysis
    try {
      console.log('📸 Trying AI vision analysis...');
      const visionResult = await this.analyzeVoucherImage(imageBlob);
      if (visionResult.amount && visionResult.confidence > 0.5) {
        results.push({...visionResult, confidence: visionResult.confidence * 1.2}); // Boost vision confidence
      }
    } catch (error) {
      console.log('Vision analysis failed, continuing with other methods...');
    }

    // Method 2: AI-Enhanced OCR Analysis
    if (ocrText) {
      try {
        console.log('📝 Trying AI-enhanced OCR analysis...');
        const ocrResult = await this.enhanceOCRWithAI(ocrText);
        if (ocrResult.amount && ocrResult.confidence > 0.3) {
          results.push(ocrResult);
        }
      } catch (error) {
        console.log('OCR enhancement failed, continuing...');
      }
    }

    // Select best result
    if (results.length === 0) {
      return {
        amount: null,
        currency: 'EGP',
        confidence: 0,
        aiReasoning: 'All AI analysis methods failed'
      };
    }

    // Return result with highest confidence
    const bestResult = results.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    console.log(`✅ AI analysis complete. Best result: ${bestResult.amount} ${bestResult.currency} (confidence: ${bestResult.confidence})`);

    return bestResult;
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
