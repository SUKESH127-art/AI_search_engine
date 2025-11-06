import { useEffect, useState } from "react";
import { Loader2, Search, Sparkles, FileText } from "lucide-react";

const steps = [
  { icon: Search, text: "Searching the web..." },
  { icon: Sparkles, text: "Synthesizing sources..." },
  { icon: FileText, text: "Generating answer..." },
];

const LoadingJourney = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-8">
      {/* Animated loader */}
      <div className="relative">
        <div className="absolute inset-0 animate-ping">
          <div className="w-20 h-20 rounded-full bg-primary/20" />
        </div>
        <div className="relative glass-strong rounded-full p-6 animate-glow-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isPast = index < currentStep;
          
          return (
            <div
              key={index}
              className={`flex items-center gap-3 transition-all duration-500 ${
                isActive 
                  ? 'opacity-100 translate-x-0 scale-100' 
                  : isPast 
                  ? 'opacity-40 -translate-x-2 scale-95'
                  : 'opacity-20 translate-x-2 scale-95'
              }`}
            >
              <div className={`glass rounded-lg p-2 ${isActive ? 'animate-glow-pulse' : ''}`}>
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-foreground/60'}`} />
              </div>
              <p className={`text-sm ${isActive ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                {step.text}
              </p>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default LoadingJourney;
