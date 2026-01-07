import { useState, useEffect, RefObject } from 'react';

export const useReadingProgress = (contentRef: RefObject<HTMLElement>) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      if (!contentRef.current) {
        setProgress(0);
        return;
      }

      const element = contentRef.current;
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top;
      const elementHeight = element.scrollHeight;
      const windowHeight = window.innerHeight;

      // Calculate how much of the article has been scrolled past
      const scrolled = Math.max(0, -elementTop);
      const scrollableHeight = elementHeight - windowHeight;

      if (scrollableHeight <= 0) {
        setProgress(100);
        return;
      }

      const percentage = Math.min(100, Math.max(0, (scrolled / scrollableHeight) * 100));
      setProgress(Math.round(percentage));
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    
    // Initial calculation
    updateProgress();

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [contentRef]);

  return progress;
};
