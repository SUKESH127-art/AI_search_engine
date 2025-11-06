import { useState } from "react";
import { Search, Image, Lightbulb, Mic, Globe, Sparkles, Paperclip, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  value?: string;
  showSuggestions?: boolean;
  placeholder?: string;
  variant?: "hero" | "compact";
  hideIcons?: boolean;
}

const suggestions = [
  "what is the capital of australia",
  "what is the capital of canada",
  "what is the capital of florida",
  "what is the capital of texas",
  "what is the capital of california",
  "what is the capital of mexico",
];

const SearchBar = ({ 
  onSearch, 
  value = "", 
  showSuggestions = false,
  placeholder = "Ask anything or @mention a Space",
  variant = "hero",
  hideIcons = false
}: SearchBarProps) => {
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowDropdown(false);
    onSearch(suggestion);
  };

  const filteredSuggestions = showSuggestions && query.length > 0
    ? suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : [];

  const isHero = variant === "hero";

  return (
    <div className={`relative w-full ${isHero ? 'max-w-3xl' : 'max-w-5xl'}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div 
          className={`glass-strong rounded-2xl transition-all duration-300 ${
            isFocused ? 'ring-2 ring-primary/50 animate-glow-pulse' : ''
          } ${isHero ? 'p-1' : 'p-0.5'}`}
        >
          <div className="relative flex items-center gap-3 px-4 py-3">
            {/* Left icons */}
            {!hideIcons && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Image className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Lightbulb className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Input */}
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(e.target.value.length > 0 && showSuggestions);
              }}
              onFocus={() => {
                setIsFocused(true);
                if (query.length > 0 && showSuggestions) setShowDropdown(true);
              }}
              onBlur={() => {
                setIsFocused(false);
                setTimeout(() => setShowDropdown(false), 200);
              }}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-foreground placeholder:text-foreground/40 outline-none text-base"
            />

            {/* Right icons */}
            {!hideIcons && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Globe className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showDropdown && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 glass-strong rounded-2xl p-2 animate-fade-in-up">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-foreground/5 transition-colors flex items-center gap-3 text-foreground/80 hover:text-foreground"
              >
                <Search className="h-4 w-4 text-foreground/40" />
                <span className="text-sm">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

export default SearchBar;
