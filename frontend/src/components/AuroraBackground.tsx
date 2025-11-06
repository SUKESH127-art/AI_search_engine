'use client'

import Iridescence from './Iridescence'

const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none transition-opacity duration-500">
      {/* Iridescence gradient with WebGL */}
      <div 
        className="absolute inset-0 w-full h-full" 
        style={{ 
          filter: 'hue-rotate(330deg)',
          transform: 'scale(1.2)',
        }}
      >
        <Iridescence
          color={[0.9, 0.7, 1]} // White base - hue-rotate will colorize it
          amplitude={0.1}
          speed={1.0}
          mouseReact={false}
        />
      </div>
      
      {/* Grain texture overlay */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
          opacity: 0.1,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  )
}

export default AuroraBackground
