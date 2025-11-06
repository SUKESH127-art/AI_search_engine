import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";
import Galaxy from "@/components/Galaxy";
import { Button } from "@/components/ui/button";
import { ExternalLink, ThumbsUp, ThumbsDown, Copy, Image as ImageIcon, Search as SearchIcon, Sparkles, FileText, TreePine, Workflow, Filter, CheckCircle2 } from "lucide-react";
import { useSearchContext } from "@/contexts/SearchContext";
import { useToast } from "@/hooks/use-toast";
import { getRelatedQuestions } from "@/lib/api";

const LOADING_STEPS = [
  { icon: SearchIcon, text: "Searching the web..." },
  { icon: Filter, text: "Evaluating top sources..." },
  { icon: Sparkles, text: "Summarizing findings..." },
  { icon: ImageIcon, text: "Enriching visuals..." },
  { icon: FileText, text: "Drafting response..." },
  { icon: CheckCircle2, text: "Polishing answer..." },
];
const FINAL_LOADING_STEP_INDEX = LOADING_STEPS.length - 1;
const MAX_IN_PROGRESS_STEP_INDEX = Math.max(0, LOADING_STEPS.length - 2);

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const { isLoading, searchResults, searchQuery, setSearchResults } = useSearchContext();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"hypersearch" | "images" | "sources" | "steps" | "related">("hypersearch");
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  const [loadingRelatedQuestions, setLoadingRelatedQuestions] = useState(false);
  // Initialize background state based on initial loading state
  const [showGalaxy, setShowGalaxy] = useState(() => isLoading);
  const [showJellyfish, setShowJellyfish] = useState(() => !isLoading);
  
  // Use refs to store interval IDs for cleanup
  const fallbackStepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const steps = LOADING_STEPS;

  // Handle background transitions smoothly
  useEffect(() => {
    if (isLoading) {
      // Show galaxy immediately when loading starts
      setShowGalaxy(true);
      // Hide jellyfish after a brief delay to allow smooth transition
      const timer = setTimeout(() => {
        setShowJellyfish(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Keep galaxy visible during fade-out, then hide it
      // First show jellyfish (it will fade in)
      setShowJellyfish(true);
      // Delay hiding galaxy to allow smooth cross-fade transition
      const timer = setTimeout(() => {
        setShowGalaxy(false);
      }, 500); // Match the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Fetch data when query changes
  useEffect(() => {
    if (!query) return;

    if (fallbackStepIntervalRef.current) {
      clearInterval(fallbackStepIntervalRef.current);
      fallbackStepIntervalRef.current = null;
    }

    // Reset state completely for new search
    setSearchResults(null);
    setCurrentStep(0);
    setUpvoted(false);
    setDownvoted(false);
    setActiveTab("hypersearch");
    setRelatedQuestions([]);
    setLoadingRelatedQuestions(false);
    // Reset background states to show loading animation immediately
    setShowGalaxy(true);
    setShowJellyfish(false);

    // Animate loading steps locally while waiting on the request
    fallbackStepIntervalRef.current = setInterval(() => {
      // Only animate if we're still loading
      if (isLoadingRef.current) {
        setCurrentStep((prev) => {
          if (prev < MAX_IN_PROGRESS_STEP_INDEX) return prev + 1;
          return prev; // Keep at last in-progress step until done
        });
      } else {
        if (fallbackStepIntervalRef.current) {
          clearInterval(fallbackStepIntervalRef.current);
          fallbackStepIntervalRef.current = null;
        }
      }
    }, 2000); // Slower fallback interval

    // Fetch from API
    searchQuery(query)
      .then((response) => {
        // Stop animation when search completes
        if (fallbackStepIntervalRef.current) {
          clearInterval(fallbackStepIntervalRef.current);
          fallbackStepIntervalRef.current = null;
        }
        
        setCurrentStep(FINAL_LOADING_STEP_INDEX); // Complete all steps
        
        // Fetch related questions as soon as results are loaded
        setLoadingRelatedQuestions(true);
        getRelatedQuestions(query)
          .then((relatedResponse) => {
            setRelatedQuestions(relatedResponse.questions || []);
          })
          .catch((error) => {
            console.error('Failed to fetch related questions:', error);
            // Don't show error toast - related questions are not critical
          })
          .finally(() => {
            setLoadingRelatedQuestions(false);
          });
      })
      .catch((error) => {
        // Stop animation on error too
        if (fallbackStepIntervalRef.current) {
          clearInterval(fallbackStepIntervalRef.current);
          fallbackStepIntervalRef.current = null;
        }
        
        console.error('Search failed:', error);
        toast({
          title: "Search failed",
          description: error.message || "Failed to fetch search results. Please try again.",
          variant: "destructive",
        });
      });

    // Cleanup function
    return () => {
      if (fallbackStepIntervalRef.current) {
        clearInterval(fallbackStepIntervalRef.current);
        fallbackStepIntervalRef.current = null;
      }
    };
  }, [query, searchQuery, setSearchResults, toast]);

  const handleVote = (type: "up" | "down") => {
    if (type === "up") {
      setUpvoted(!upvoted);
      setDownvoted(false);
    } else {
      setDownvoted(!downvoted);
      setUpvoted(false);
    }
  };

  const handleCopy = async () => {
    if (!searchResults) return;
    
    // Build text content from search results
    let answerText = searchResults.overview || "";
    
    // Add topics
    if (searchResults.topics && searchResults.topics.length > 0) {
      answerText += "\n\n";
      searchResults.topics.forEach((topic) => {
        answerText += `${topic.title}\n${topic.content}\n\n`;
      });
    }

    try {
      await navigator.clipboard.writeText(answerText);
      toast({
        title: "Copied!",
        description: "Answer copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = answerText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
          title: "Copied!",
          description: "Answer copied to clipboard",
        });
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        toast({
          title: "Copy failed",
          description: "Failed to copy text to clipboard",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const handleSearch = (newQuery: string) => {
    navigate(`/search?q=${encodeURIComponent(newQuery)}`);
    setCurrentStep(0);
    setActiveTab("hypersearch");
    setUpvoted(false);
    setDownvoted(false);
  };

  if (!query) {
    navigate("/");
    return null;
  }


  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Galaxy background when loading - with smooth transition */}
      {showGalaxy && (
        <div 
          className="fixed inset-0 z-[1] w-screen h-screen pointer-events-none overflow-hidden flex items-center justify-center"
          style={{
            opacity: isLoading ? 1 : 0,
            transition: 'opacity 500ms ease-in-out',
            pointerEvents: isLoading ? 'none' : 'none',
          }}
        >
          <Galaxy
            mouseRepulsion={true}
            mouseInteraction={true}
            density={1.5}
            glowIntensity={0.5}
            saturation={0.8}
            hueShift={220}
            starSpeed={2.5}
            speed={2.5}
            transparent={true}
          />
        </div>
      )}

      {/* Jellyfish background for results page - with smooth transition */}
      {showJellyfish && (
        <div 
          className="fixed inset-0 z-[1] w-screen h-screen pointer-events-none overflow-hidden"
          style={{
            backgroundImage: 'url(/jelly_fish.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: isLoading ? 0 : 0.65,
            transition: 'opacity 500ms ease-in-out',
          }}
        />
      )}
      
      <div className="relative z-[10] min-h-screen bg-transparent">
        <Sidebar hideIcons={isLoading} />
        
        <main className={`relative ${isLoading ? "min-h-screen" : "ml-20 min-h-screen"}`}>
          <div className="max-w-5xl mx-auto px-8 py-8 relative z-10">

            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-8">
                {/* Steps - Status Updates */}
                <div className="flex flex-col gap-4 w-full max-w-md">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === currentStep;
                    const isPast = index < currentStep;
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-4 transition-all duration-500 ${
                          isActive 
                            ? 'opacity-100 translate-x-0 scale-100' 
                            : isPast 
                            ? 'opacity-50 -translate-x-2 scale-95'
                            : 'opacity-30 translate-x-2 scale-95'
                        }`}
                      >
                        <div 
                          className={`rounded-xl p-3 flex-shrink-0 transition-all ${
                            isActive ? 'animate-glow-pulse' : ''
                          }`}
                          style={{
                            background: isActive 
                              ? 'hsl(0 0% 100% / 0.15)' 
                              : 'hsl(0 0% 100% / 0.08)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            border: `1px solid ${isActive ? 'hsl(0 0% 100% / 0.25)' : 'hsl(0 0% 100% / 0.18)'}`,
                            boxShadow: isActive 
                              ? '0 8px 32px 0 hsl(0 0% 0% / 0.15), 0 0 20px hsl(190 85% 55% / 0.2)' 
                              : '0 8px 32px 0 hsl(0 0% 0% / 0.1)',
                          }}
                        >
                          <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-foreground/60'}`} />
                        </div>
                        <div 
                          className="flex-1 rounded-xl px-4 py-3 transition-all"
                          style={{
                            background: isActive 
                              ? 'hsl(0 0% 100% / 0.12)' 
                              : 'hsl(0 0% 100% / 0.06)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: `1px solid ${isActive ? 'hsl(0 0% 100% / 0.2)' : 'hsl(0 0% 100% / 0.15)'}`,
                            boxShadow: '0 4px 16px 0 hsl(0 0% 0% / 0.08)',
                          }}
                        >
                          <p className={`text-sm ${isActive ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                            {step.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}

          {/* Answer */}
          {!isLoading && searchResults && (
            <div className="space-y-6">
              {/* Tabs with Search Bar */}
              <div className="rounded-2xl px-4 py-2 flex items-center justify-between gap-3">
                <div className="inline-flex gap-2">
                <div 
                  className="rounded-xl px-3 py-1.5 transition-all flex items-center justify-center"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    onClick={() => setActiveTab("hypersearch")}
                  >
                        <Sparkles className="h-4 w-4" />
                        Findings
                  </Button>
                </div>
                <div 
                  className="rounded-xl px-3 py-1.5 transition-all flex items-center justify-center"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    onClick={() => setActiveTab("images")}
                  >
                        <ImageIcon className="h-4 w-4" />
                        Images
                  </Button>
                </div>
                <div 
                  className="rounded-xl px-3 py-1.5 transition-all flex items-center justify-center"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    onClick={() => setActiveTab("sources")}
                  >
                        <FileText className="h-4 w-4 mr-1" />
                        Sources
                    ({searchResults?.sources?.length || 0})
                  </Button>
                </div>
                <div 
                  className="rounded-xl px-3 py-1.5 transition-all flex items-center justify-center"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    onClick={() => setActiveTab("steps")}
                      >
                        
                        <Workflow className="h-4 w-4" />
                        Steps
                  </Button>
                </div>
                <div 
                  className="rounded-xl px-3 py-1.5 transition-all flex items-center justify-center"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    onClick={() => setActiveTab("related")}
                  >
                        <TreePine className="h-4 w-4 mr-1" />
                        Similar
                    ({searchResults?.topics?.length || 0})
                      </Button>
                      
                </div>
                </div>

                {/* Search Bar on the right */}
                <div className="flex-shrink-0">
                  <div 
                    className="relative flex items-center gap-2 px-3 h-8 rounded-xl"
                    style={{
                      background: 'hsl(0 0% 100% / 0.05)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid hsl(0 0% 100% / 0.1)',
                    }}
                  >
                    <SearchIcon className="h-3.5 w-3.5 text-foreground/60 flex-shrink-0" />
                    <input
                      type="text"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch(e.currentTarget.value);
                        }
                      }}
                      placeholder="    Keep Exploring?"
                      className="bg-transparent text-foreground placeholder:text-foreground/40 outline-none text-sm w-40 focus:outline-none h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Content based on active tab */}
              {activeTab === "hypersearch" && (
                <>
                  {/* Answer text with structured format */}
                  <div 
                    className="rounded-2xl p-8 animate-fade-in-up" 
                    style={{ 
                      animationDelay: '400ms',
                      background: 'hsl(0 0% 100% / 0.05)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid hsl(0 0% 100% / 0.1)',
                    }}
                  >
                    {/* Overview */}
                    {searchResults.overview && (
                      <div className="mb-6">
                        <p className="text-foreground/90 leading-relaxed mb-2 whitespace-pre-wrap">
                          {searchResults.overview}
                        </p>
                        {searchResults.overview_image && (
                          <div className="mt-4 rounded-lg overflow-hidden">
                            <img 
                              src={searchResults.overview_image} 
                              alt="Overview" 
                              className="w-full max-w-md mx-auto object-cover"
                              style={{ maxHeight: '300px' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Topics */}
                    {searchResults.topics && searchResults.topics.length > 0 && (
                      <>
                        {searchResults.topics.map((topic, index) => (
                          <div key={index} className="mb-6">
                            <h3 className="text-lg font-semibold text-foreground mb-3">{topic.title}</h3>
                            <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                              {topic.content}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  
                  {/* Floating feedback buttons underneath the card */}
                  <div className="flex items-center gap-1.5 mt-4 justify-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`glass hover:glass-strong rounded-lg h-7 w-7 p-0 flex items-center justify-center cursor-pointer ${upvoted ? "bg-primary/20" : ""}`}
                      onClick={() => handleVote("up")}
                      style={{
                        background: 'hsl(0 0% 100% / 0.05)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid hsl(0 0% 100% / 0.1)',
                      }}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`glass hover:glass-strong rounded-lg h-7 w-7 p-0 flex items-center justify-center cursor-pointer ${downvoted ? "bg-destructive/20" : ""}`}
                      onClick={() => handleVote("down")}
                      style={{
                        background: 'hsl(0 0% 100% / 0.05)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid hsl(0 0% 100% / 0.1)',
                      }}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="glass hover:glass-strong rounded-lg h-7 w-7 p-0 flex items-center justify-center cursor-pointer"
                      onClick={handleCopy}
                      style={{
                        background: 'hsl(0 0% 100% / 0.05)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid hsl(0 0% 100% / 0.1)',
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}

              {activeTab === "images" && (
                <div 
                  className="rounded-2xl p-8"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  {searchResults.overview_image ? (
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold text-foreground mb-4">Overview Image</h2>
                      <div className="rounded-lg overflow-hidden">
                        <img 
                          src={searchResults.overview_image} 
                          alt="Overview" 
                          className="w-full max-w-md mx-auto object-cover"
                          style={{ maxHeight: '300px' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-foreground/60 text-center py-8">No images available for this query.</p>
                  )}
                  {searchResults.sources && searchResults.sources.some(s => s.image) && (
                    <div className="mt-8">
                      <h2 className="text-xl font-semibold text-foreground mb-4">Source Images</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {searchResults.sources
                          .filter(s => s.image)
                          .map((source, index) => (
                            <div key={index} className="rounded-lg overflow-hidden">
                              <img 
                                src={source.image!} 
                                alt={source.title} 
                                className="w-full h-48 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "sources" && (
                <div 
                  className="rounded-2xl p-8"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <h2 className="text-xl font-semibold text-foreground mb-4">Sources</h2>
                  {searchResults.sources && searchResults.sources.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.sources.map((source, index) => {
                        let domain = '';
                        try {
                          if (source.url) {
                            domain = new URL(source.url).hostname.replace('www.', '');
                          }
                        } catch (e) {
                          domain = source.url || '';
                        }
                        return (
                          <a
                            key={source.id || index}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block glass hover:glass-strong rounded-xl p-4 transition-all hover:scale-[1.01]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 glass rounded flex items-center justify-center text-sm text-primary font-medium flex-shrink-0">
                                {source.id || index + 1}
                              </div>
                              {source.image && (
                                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden glass">
                                  <img 
                                    src={source.image} 
                                    alt={source.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-foreground mb-1 line-clamp-2">{source.title}</h3>
                                {source.extended_snippet && (
                                  <p className="text-xs text-foreground/60 mb-1 line-clamp-2">{source.extended_snippet}</p>
                                )}
                                <p className="text-xs text-foreground/40 truncate">{domain}</p>
                              </div>
                              <ExternalLink className="h-4 w-4 text-foreground/40 flex-shrink-0" />
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-foreground/60 text-center py-8">No sources available.</p>
                  )}
                </div>
              )}

              {activeTab === "steps" && (
                <div 
                  className="rounded-2xl p-8"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <h2 className="text-xl font-semibold text-foreground mb-4">Search Steps</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">1</div>
                      <div>
                        <p className="text-foreground font-medium">Searching the web</p>
                        <p className="text-sm text-foreground/60">Found 4 relevant sources</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">2</div>
                      <div>
                        <p className="text-foreground font-medium">Analyzing content</p>
                        <p className="text-sm text-foreground/60">Extracted key information from sources</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">3</div>
                      <div>
                        <p className="text-foreground font-medium">Generating answer</p>
                        <p className="text-sm text-foreground/60">Synthesized comprehensive response</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "related" && (
                <div 
                  className="rounded-2xl p-8"
                  style={{
                    background: 'hsl(0 0% 100% / 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid hsl(0 0% 100% / 0.1)',
                  }}
                >
                  <h2 className="text-xl font-semibold text-foreground mb-4">Related Questions</h2>
                  {loadingRelatedQuestions ? (
                    <div className="text-center py-8">
                      <p className="text-foreground/60">Loading related questions...</p>
                    </div>
                  ) : relatedQuestions && relatedQuestions.length > 0 ? (
                    <div className="space-y-3">
                      {relatedQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearch(question)}
                          className="w-full glass hover:glass-strong rounded-xl p-4 text-left transition-all hover:scale-[1.01] flex items-center justify-between group"
                        >
                          <span className="text-foreground text-sm">{question}</span>
                          <SearchIcon className="h-4 w-4 text-foreground/40 group-hover:text-primary transition-colors" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-foreground/60 text-center py-8">No related questions available.</p>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Search;
