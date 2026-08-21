import { Injectable } from '@nestjs/common';
import type { PageTextResult} from 'pdf-parse';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfTextExtractorService {
  async extract(document: Buffer): Promise<PageTextResult[]> {
    const parser = new PDFParse({
      data: document,
    });

    const textResult = await parser.getText();

    return textResult.pages;
  }
}
