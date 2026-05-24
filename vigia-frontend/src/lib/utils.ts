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
