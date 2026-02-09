import React, { useEffect, useState } from 'react';

const SplashScreen = ({ onComplete }) => {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Show splash screen for 2.5 seconds
    const timer = setTimeout(() => {
      setIsAnimating(false);
      // Wait for fade out animation before calling onComplete
      setTimeout(() => {
        onComplete();
      }, 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-teal-600 transition-opacity duration-500 ${isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
    >
      <div className="text-center">
        {/* Logo with multiple animations */}
        <div className="relative animate-splash-zoom">
          <div className="absolute inset-0 bg-white/20 rounded-3xl blur-3xl animate-pulse-slow"></div>
          <img
            src="/pwa-icon.png"
            alt="Satrong Sajghor"
            className="relative w-40 h-40 mx-auto drop-shadow-2xl animate-splash-rotate"
          />
        </div>

        {/* App Name with slide up animation */}
        <h1 className="mt-8 text-4xl font-extrabold text-white animate-slide-up-fade">
          Satrong Sajghor
        </h1>

        {/* Subtitle with delayed slide up */}
        <p className="mt-2 text-lg text-white/90 animate-slide-up-fade-delay">
          Savings & Business Management
        </p>

        {/* Loading dots animation */}
        <div className="flex justify-center mt-8 space-x-2 animate-slide-up-fade-delay2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce-dot" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce-dot" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce-dot" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>

      {/* Custom CSS animations */}
      <style jsx>{`
        @keyframes splash-zoom {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes splash-rotate {
          0% {
            transform: rotate(0deg) scale(0.5);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }

        @keyframes slide-up-fade {
          0% {
            transform: translateY(30px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes bounce-dot {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-splash-zoom {
          animation: splash-zoom 1s ease-out forwards;
        }

        .animate-splash-rotate {
          animation: splash-rotate 1.5s ease-out forwards;
        }

        .animate-slide-up-fade {
          animation: slide-up-fade 0.8s ease-out 0.5s forwards;
          opacity: 0;
        }

        .animate-slide-up-fade-delay {
          animation: slide-up-fade 0.8s ease-out 0.8s forwards;
          opacity: 0;
        }

        .animate-slide-up-fade-delay2 {
          animation: slide-up-fade 0.8s ease-out 1.1s forwards;
          opacity: 0;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        .animate-bounce-dot {
          animation: bounce-dot 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
