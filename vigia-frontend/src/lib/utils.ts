import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateIDTablaWS() {
  // Generates a unique alfanumeric ID, max 50 chars as requested
  const prefix = 'VIGIA';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function parseComprobanteNumber(input: string | number) {
  const str = String(input || '').replace(/\D/g, '');
  if (str.length > 4) {
    const pos = str.slice(0, 4).padStart(4, '0');
    const num = str.slice(4).padStart(8, '0');
    return { pos, num };
  }
  return { pos: '0001', num: str.padStart(8, '0') };
}

export function formatISOToReadable(isoDate: string) {
  if (!isoDate) return '-';
  try {
    return new Date(isoDate).toLocaleDateString('es-AR');
  } catch {
    return isoDate;
  }
}

export function formatCurrency(amount: number, currency: string = 'ARS') {
  let normalizedCurrency = currency.toUpperCase().trim();
  if (normalizedCurrency === 'US$' || normalizedCurrency === 'U$S') {
    normalizedCurrency = 'USD';
  } else if (normalizedCurrency === '$') {
    normalizedCurrency = 'ARS';
  }
  
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount);
  } catch (e) {
    // Fallback if the currency code is completely invalid
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount) + ` (${currency})`;
  }
}

/**
 * Optimizes an uploaded image on the client side (resizing and compressing to JPEG)
 * to reduce payload size and dramatically speed up PDF/Image OCR and API times.
 * If the file is not an image (e.g., PDF), it reads it as standard base64 directly.
 */
export async function optimizeFileIfNeeded(file: File): Promise<{ base64: string; mimeType: string }> {
  if (!file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600; // Maximun dimension for high-quality OCR text legibility
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Export as image/jpeg with 0.8 quality (perfect blend of small size and high legibility)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, mimeType: 'image/jpeg' });
        } else {
          // Fallback if canvas context creation fails
          const result = event.target?.result as string;
          const base64 = result.split(',')[1];
          resolve({ base64, mimeType: file.type });
        }
      };
      img.onerror = () => {
        // Fallback on image load error
        const result = event.target?.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
