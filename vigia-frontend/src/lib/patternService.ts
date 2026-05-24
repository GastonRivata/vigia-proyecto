
interface Pattern {
  provider: string;
  centroCosto: string;
  cuentaCorriente: string;
  cliente: string;
  distribucion: { cc1: number; cc2: number };
  lastUsed: string;
}

class PatternService {
  private STORAGE_KEY = 'leia_patterns';

  getPatterns(): Record<string, Pattern> {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  savePattern(provider: string, data: Partial<Pattern>) {
    const patterns = this.getPatterns();
    patterns[provider] = {
      provider,
      centroCosto: data.centroCosto || patterns[provider]?.centroCosto || '',
      cuentaCorriente: data.cuentaCorriente || patterns[provider]?.cuentaCorriente || '',
      cliente: data.cliente || patterns[provider]?.cliente || '',
      distribucion: data.distribucion || patterns[provider]?.distribucion || { cc1: 100, cc2: 0 },
      lastUsed: new Date().toISOString(),
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patterns));
  }

  suggest(provider: string): Pattern | null {
    const patterns = this.getPatterns();
    return patterns[provider] || null;
  }

  getLog(): Pattern[] {
    return Object.values(this.getPatterns()).sort((a, b) => 
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }
}

export const patternService = new PatternService();
