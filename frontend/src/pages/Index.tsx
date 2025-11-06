import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import ExpandableSearch from "@/components/ExpandableSearch";
import AuroraBackground from "@/components/AuroraBackground";

const Index = () => {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AuroraBackground />
      <Sidebar hideIcons />
      
      <main className="relative z-[10] min-h-screen flex flex-col items-center justify-center px-4 sm:px-8 pt-20">
        <div className="w-full max-w-4xl space-y-8 animate-fade-in flex flex-col items-center">
          {/* Main Heading */}
          <div className="text-center mb-12 px-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight">
                search on hyperdrive
            </h1>
          </div>

          {/* Expandable Search */}
          <ExpandableSearch onSearch={handleSearch} />
        </div>
      </main>
    </div>
  );
};

export default Index;
