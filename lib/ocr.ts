export interface OCRProvider {
  name: string;
  parseToMarkdown(fileBuffer: Buffer, mimeType: string): Promise<string>;
}

class MistralOCRProvider implements OCRProvider {
  name = "mistral-ocr";

  async parseToMarkdown(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY is not set");

    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: dataUrl,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mistral OCR error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const pages = data.pages ?? data.results ?? [];
    return pages
      .map((p: { markdown?: string; text?: string }) => p.markdown ?? p.text ?? "")
      .join("\n\n---\n\n");
  }
}

let currentProvider: OCRProvider = new MistralOCRProvider();

export function getOCRProvider(): OCRProvider {
  return currentProvider;
}

export function setOCRProvider(provider: OCRProvider): void {
  currentProvider = provider;
}

export async function parseFileToMarkdown(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "md" || ext === "txt" || mimeType === "text/plain" || mimeType === "text/markdown") {
    return fileBuffer.toString("utf-8");
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    return getOCRProvider().parseToMarkdown(fileBuffer, mimeType);
  }

  throw new Error(`Unsupported file type: ${ext} (${mimeType})`);
}
