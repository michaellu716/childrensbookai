import { useState, useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const LazyImage = ({ src, alt, className, fallback, onError }: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => setIsLoaded(true);
  
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    onError?.(e);
  };

  if (!src || hasError) {
    return fallback || <div className={className} />;
  }

  return (
    <div ref={imgRef} className="relative">
      {!isLoaded && (
        <Skeleton className={`absolute inset-0 ${className}`} />
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
};