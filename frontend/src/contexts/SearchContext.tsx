import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { askQuestion, type AskResponse } from '@/lib/api';

interface SearchContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  searchResults: AskResponse | null;
  setSearchResults: (results: AskResponse | null) => void;
  searchQuery: (query: string) => Promise<AskResponse>;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<AskResponse | null>(null);

  const searchQuery = useCallback(async (query: string): Promise<AskResponse> => {
    setIsLoading(true);
    try {
      const response = await askQuestion({
        query: query.trim(),
      });
      setSearchResults(response);
      return response;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <SearchContext.Provider 
      value={{ 
        isLoading, 
        setIsLoading, 
        searchResults, 
        setSearchResults,
        searchQuery,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearchContext = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
};

