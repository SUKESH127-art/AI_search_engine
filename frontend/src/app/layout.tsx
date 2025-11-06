import type { Metadata } from 'next'
import '../index.css'

export const metadata: Metadata = {
  title: 'Hypersearch - AI Search Engine',
  description: 'Beautiful AI-powered search with glassmorphic design',
  authors: [{ name: 'Hypersearch' }],
  openGraph: {
    title: 'Hypersearch - AI Search Engine',
    description: 'Beautiful AI-powered search with glassmorphic design',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hypersearch - AI Search Engine',
    description: 'Beautiful AI-powered search with glassmorphic design',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function removeNextjsIndicator() {
                  // Remove Next.js development indicator
                  const indicators = document.querySelectorAll(
                    'div[data-nextjs-toast], div[data-nextjs-toast-root], #__nextjs-toast-root, [id*="nextjs"], [class*="nextjs-dev-indicator"]'
                  );
                  indicators.forEach(el => el.remove());
                  
                  // Also check for fixed positioned elements in bottom left
                  const allDivs = document.querySelectorAll('body > div');
                  allDivs.forEach(div => {
                    const style = window.getComputedStyle(div);
                    const position = style.position;
                    const bottom = style.bottom;
                    const left = style.left;
                    const width = style.width;
                    const height = style.height;
                    
                    // Check if it's a small fixed element in bottom left (likely the indicator)
                    if (position === 'fixed' && 
                        (bottom === '20px' || bottom === '1rem' || parseInt(bottom) < 100) &&
                        (left === '20px' || left === '1rem' || parseInt(left) < 100) &&
                        (width === height || Math.abs(parseInt(width) - parseInt(height)) < 10) &&
                        parseInt(width) < 60) {
                      div.remove();
                    }
                  });
                }
                
                // Run immediately
                removeNextjsIndicator();
                
                // Run after DOM is ready
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', removeNextjsIndicator);
                }
                
                // Run periodically to catch dynamically added elements
                setInterval(removeNextjsIndicator, 100);
                
                // Also observe DOM changes
                const observer = new MutationObserver(removeNextjsIndicator);
                observer.observe(document.body, { childList: true, subtree: true });
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}

