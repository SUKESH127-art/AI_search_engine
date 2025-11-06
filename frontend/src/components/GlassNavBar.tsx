'use client'

import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useSearchContext } from "@/contexts/SearchContext";
import { ArrowLeft } from "lucide-react";

const GlassNavBar = () => {
  const location = useLocation();
  const isSearchPage = location.pathname === '/search';
  const { isLoading } = useSearchContext();
  const navigate = useNavigate();
  
  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  // Hide navbar on results page (when loading is done)
  const isMinimized = isSearchPage && !isLoading;

  // Normal state: full navbar
  const isHomePage = location.pathname === '/';
  const isSmallNavbar = isHomePage || isLoading;
  return (
    <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full ${isSmallNavbar ? 'max-w-sm' : 'max-w-[20rem]'} px-4 transition-all duration-500 ${
      isMinimized ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 pointer-events-auto scale-100'
    }`}>
      <div 
        className={`rounded-full ${isSmallNavbar ? 'px-3' : 'px-5'} py-3 flex items-center ${isLoading ? 'justify-between relative' : 'justify-between'}`}
        style={{
          background: 'hsl(0 0% 100% / 0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid hsl(0 0% 100% / 0.18)',
          boxShadow: '0 8px 32px 0 hsl(0 0% 0% / 0.1)',
        }}
      >
        {/* Left side - back button when loading, logo+text when not loading */}
        {isLoading ? (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:opacity-80 transition-opacity flex-shrink-0"
            style={{
              background: 'hsl(0 0% 100% / 0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid hsl(0 0% 100% / 0.18)',
            }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        ) : (
          <NavLink 
            to="/" 
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          >
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'hsl(0 0% 100% / 0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid hsl(0 0% 100% / 0.18)',
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                className="w-5 h-5 text-white" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                {/* Star constellation / hypersearch warp effect */}
                <path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"/>
                <circle cx="12" cy="11" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-base tracking-tight">
              hypersearch
            </span>
          </NavLink>
        )}

        {/* Center - hypersearching text when loading */}
        {isLoading && (
          <span className="absolute left-1/2 -translate-x-1/2 text-white font-semibold text-base tracking-tight">
            hypersearching!
          </span>
        )}

        {/* Right side - logo when loading, navigation links when not loading */}
        {isLoading ? (
          <NavLink 
            to="/" 
            className="flex items-center hover:opacity-80 transition-opacity group"
          >
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'hsl(0 0% 100% / 0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid hsl(0 0% 100% / 0.18)',
              }}
            >
              <div className="animate-spin" style={{ animationDuration: '1.4s', transformOrigin: '50% 50%' }}>
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-5 h-5 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  {/* Star constellation / hypersearch warp effect */}
                  <path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"/>
                  <circle cx="12" cy="11" r="1.5" fill="currentColor"/>
                </svg>
              </div>
            </div>
          </NavLink>
        ) : (
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              className={`text-white/90 hover:text-white transition-colors text-sm font-medium rounded-lg py-2 ${isSmallNavbar ? 'px-2' : 'px-4'}`}
              activeClassName="text-white bg-white/10"
            >
              Home
            </NavLink>
            {!isHomePage && (
              <NavLink
                to="/search"
                className={`text-white/90 hover:text-white transition-colors text-sm font-medium rounded-lg py-2 ${isSmallNavbar ? 'px-2' : 'px-4'}`}
                activeClassName="text-white bg-white/10"
              >
                Search
              </NavLink>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default GlassNavBar;

