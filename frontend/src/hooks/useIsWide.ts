import { useEffect, useState } from 'react';

// Tailwind's `lg` breakpoint: from here up there is room for the seven-column table.
const WIDE_QUERY = '(min-width: 1024px)';

function matches(): boolean {
  // Where the browser cannot tell (a test environment), assume a wide screen.
  return typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_QUERY).matches;
}

/**
 * True when the screen is wide enough for the table. Used to mount either the
 * table or the card list, never both: rendering every record twice would double
 * the work of each live update and duplicate every control in the page.
 */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return wide;
}
