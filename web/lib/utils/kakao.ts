declare global {
  interface Window {
    kakao: any;
  }
}

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '';

// Track which libraries have been loaded in the current script
let loadedLibraries: Set<string> = new Set();

/**
 * Load Kakao Maps SDK, optionally with extra libraries (e.g. "services,clusterer").
 * Resolves once `kakao.maps` is fully initialised.
 * If additional libraries are requested that weren't in the original load,
 * reloads the SDK with all required libraries.
 */
export function ensureKakaoLoaded(libraries?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!KAKAO_APP_KEY) {
      reject(new Error('NEXT_PUBLIC_KAKAO_JS_KEY is not set'));
      return;
    }

    const requested = libraries ? libraries.split(',').map(l => l.trim()) : [];
    const missing = requested.filter(lib => !loadedLibraries.has(lib));

    // All requested libraries already loaded and SDK ready
    if (missing.length === 0 && window.kakao?.maps?.LatLng) {
      resolve();
      return;
    }

    // Need to reload with additional libraries
    if (missing.length > 0 && window.kakao?.maps) {
      const existing = document.querySelector('script[src*="dapi.kakao.com"]');
      if (existing) existing.remove();
      delete window.kakao.maps;
    }

    // SDK object exists but autoload hasn't fired yet
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => {
        requested.forEach(lib => loadedLibraries.add(lib));
        resolve();
      });
      return;
    }

    // Remove stale script tag if present
    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) existing.remove();

    // Merge all libraries we need
    const allLibs = new Set([...loadedLibraries, ...requested]);
    const libParam = allLibs.size > 0 ? `&libraries=${[...allLibs].join(',')}` : '';
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false${libParam}`;
    script.onload = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => {
          allLibs.forEach(lib => loadedLibraries.add(lib));
          resolve();
        });
      } else {
        reject(new Error('Kakao SDK loaded but kakao.maps not available'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'));
    document.head.appendChild(script);
  });
}
