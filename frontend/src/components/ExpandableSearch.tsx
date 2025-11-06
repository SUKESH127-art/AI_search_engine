'use client'

import { useState, useRef, useEffect } from "react";
import { Rocket, ArrowRight } from "lucide-react";

interface ExpandableSearchProps {
  onSearch: (query: string) => void;
}

const ExpandableSearch = ({ onSearch }: ExpandableSearchProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [inputWidth, setInputWidth] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  
  // Responsive base width: smaller on mobile, larger on desktop
  const getBaseWidth = () => {
    if (typeof window === 'undefined') return 672;
    const viewportWidth = window.innerWidth;
    // On mobile (< 640px), use 90% of viewport minus padding
    if (viewportWidth < 640) {
      return Math.max(280, viewportWidth * 0.9 - 32); // 32px for padding
    }
    // On tablet (640px - 1024px), use 80% of viewport
    if (viewportWidth < 1024) {
      return Math.max(400, viewportWidth * 0.8);
    }
    // On desktop, use fixed width
    return 672; // max-w-2xl = 42rem = 672px
  };
  
  const baseWidth = getBaseWidth();

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Handle window resize to recalculate widths
  useEffect(() => {
    const handleResize = () => {
      if (isExpanded && inputWidth > 0) {
        // Recalculate width on resize
        const currentBaseWidth = getBaseWidth();
        const viewportWidth = window.innerWidth;
        const maxWidth = viewportWidth < 640 
          ? Math.max(currentBaseWidth, viewportWidth * 0.95 - 32)
          : currentBaseWidth * 2;
        setInputWidth(Math.min(inputWidth, maxWidth));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded, inputWidth]);

  useEffect(() => {
    if (measureRef.current && isExpanded) {
      // Measure the text width
      const textWidth = measureRef.current.offsetWidth;
      const currentBaseWidth = getBaseWidth();
      const minWidth = currentBaseWidth;
      
      // On mobile, don't allow expansion beyond viewport
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const maxWidth = viewportWidth < 640 
        ? Math.max(minWidth, viewportWidth * 0.95 - 32) // 95% of viewport minus padding on mobile
        : currentBaseWidth * 2; // Double the base width on larger screens
      
      // Account for button (36px) + gap (12px) + padding (48px total)
      const extraPadding = 96;
      // Calculate new width: base width + extra space needed for text, capped at maxWidth
      const neededWidth = textWidth + extraPadding;
      const newWidth = Math.min(Math.max(minWidth, neededWidth), maxWidth);
      setInputWidth(newWidth);
    } else if (!isExpanded) {
      setInputWidth(0);
    }
  }, [query, isExpanded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setInputWidth(getBaseWidth()); // Set initial width
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking inside the form
    const currentTarget = e.currentTarget;
    requestAnimationFrame(() => {
      if (!currentTarget.contains(document.activeElement) && !query.trim()) {
        setIsExpanded(false);
        setInputWidth(0);
      }
    });
  };

  const getContainerWidth = () => {
    if (!isExpanded) return '64px';
    if (inputWidth > 0) {
      // Ensure width doesn't exceed viewport on mobile
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      if (viewportWidth < 640) {
        return `${Math.min(inputWidth, viewportWidth * 0.95 - 32)}px`;
      }
      return `${inputWidth}px`;
    }
    return `${getBaseWidth()}px`;
  };

  const containerWidth = getContainerWidth();

  return (
    <>
      {/* Hidden span to measure text width */}
      <span
        ref={measureRef}
        className="absolute invisible whitespace-pre text-base font-normal"
        style={{
          fontFamily: 'inherit',
          fontSize: '1rem',
          padding: '0',
        }}
      >
        {query || 'a'}
      </span>
      <form onSubmit={handleSubmit} className="relative" onBlur={handleBlur}>
        <div
          className={`
            transition-all duration-300 ease-out
            ${isExpanded ? 'h-auto' : 'w-16 h-16'}
            rounded-full
            flex items-center justify-center
            ${isExpanded ? 'cursor-auto' : 'cursor-pointer'}
            overflow-hidden
            mx-auto
          `}
          style={{
            width: containerWidth,
            maxWidth: isExpanded 
              ? (() => {
                  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
                  if (viewportWidth < 640) {
                    return `${viewportWidth * 0.95 - 32}px`; // 95% of viewport minus padding on mobile
                  }
                  return `${getBaseWidth() * 2}px`; // Double base width on larger screens
                })()
              : '64px',
            background: 'hsl(0 0% 100% / 0.12)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid hsl(0 0% 100% / 0.18)',
            boxShadow: '0 8px 32px 0 hsl(0 0% 0% / 0.1)',
          }}
          onClick={!isExpanded ? handleClick : undefined}
        >
          {!isExpanded ? (
            <Rocket className="w-6 h-6 text-white transition-transform hover:scale-110" />
          ) : (
            <div className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-4">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="what do you want to explore"
                className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none text-sm sm:text-base min-w-0"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className={`
                  w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  transition-all duration-200
                  ${query.trim() 
                    ? 'bg-white text-background hover:bg-white/90 cursor-pointer' 
                    : 'bg-white/20 text-white/40 cursor-not-allowed'
                  }
                `}
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}
        </div>
      </form>
    </>
  );
};

export default ExpandableSearch;

