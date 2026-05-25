import { useEffect } from 'react';

const createFavicon = (content: string, isDark: boolean, borderOverlay?: string) => {
  const bg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const stroke = isDark ? '#f1f5f9' : '#1e293b';
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="2" y="2" width="96" height="96" rx="20" fill="${bg}" stroke="${border}" stroke-width="4" />
    ${borderOverlay ? `<rect x="2" y="2" width="96" height="96" rx="20" fill="none" stroke="${borderOverlay}" stroke-width="4" />` : ''}
    ${content.replace(/currentColor/g, stroke)}
    <path d="M82 18 l 1 3 l 3 1 l -3 1 l -1 3 l -1 -3 l -3 -1 l 3 -1 z" fill="#f87171" opacity="0.8" />
  </svg>`;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export function useAnimatedFavicon(theme: 'light' | 'dark') {
  useEffect(() => {
    let isMounted = true;
    const isDark = theme === 'dark';
    
    // Lucide icons equivalent paths
    const iconIdle = `<g transform="translate(20 20) scale(2.5)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </g>`;

    const iconScanning = `<g transform="translate(20 20) scale(2.5)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" opacity="0.4" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" opacity="0.4" />
    </g>
    <!-- Scanning bar overlay -->
    <rect x="0" y="45" width="100" height="6" fill="#ef4444" opacity="0.9" />
    `;

    const iconBrain = `<g transform="translate(20 20) scale(2.5)" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
      <path d="M6.002 5.125A3 3 0 0 0 6.401 6.5"/>
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
      <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
      <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </g>`;

    const iconSuccess = `<g transform="translate(20 20) scale(2.5)" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m9 15 2 2 4-4" />
    </g>`;

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const runSequence = async () => {
      while (isMounted) {
        link.href = createFavicon(iconScanning, isDark);
        await new Promise(r => setTimeout(r, 1500));
        if (!isMounted) break;
        
        link.href = createFavicon(iconBrain, isDark);
        await new Promise(r => setTimeout(r, 1200));
        if (!isMounted) break;
        
        link.href = createFavicon(iconSuccess, isDark, '#10b981');
        await new Promise(r => setTimeout(r, 1500));
        if (!isMounted) break;
        
        link.href = createFavicon(iconIdle, isDark);
        await new Promise(r => setTimeout(r, 800));
      }
    };

    runSequence();

    return () => {
      isMounted = false;
      // Revert to static icon when unmounted
      link.href = '/favicon.svg';
    };
  }, [theme]);
}
