import { useState, useEffect, useRef } from "react";
import {
  Lock,
  RefreshCw,
  CreditCard,
  Users,
  Shield,
  Clock,
  Zap,
} from "lucide-react";

type Feature = {
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  detailedPoints: string[];
  bgAccent: string;
  stats: { label: string; value: string }[];
};

export default function KeyFeatures() {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const featuresRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const currentRef = featuresRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const features: Feature[] = [
    {
      title: "Multi-Signature Escrow",
      description:
        "Enhanced security requiring approval from all parties before fund release.",
      icon: Lock,
      gradient: "from-blue-600 to-cyan-400",
      detailedPoints: [
        "Military-grade security with multiple verification layers",
        "Eliminates single points of failure in the contract",
        "StarkNet ZK-proofs ensure authenticity of signatures",
      ],
      bgAccent: "bg-blue-500/10",
      stats: [
        { label: "Security Rating", value: "99.9%" },
        { label: "Crypto Protected", value: "$12M+" },
      ],
    },
    {
      title: "Auto-Refund System",
      description:
        "Automatic return of funds if deadlines are missed or work isn't delivered.",
      icon: RefreshCw,
      gradient: "from-purple-600 to-indigo-400",
      detailedPoints: [
        "Smart time-based execution with no manual intervention",
        "Customizable grace periods to accommodate real-world scenarios",
        "Full transaction history recorded on StarkNet's blockchain",
      ],
      bgAccent: "bg-purple-500/10",
      stats: [
        { label: "Average Return Time", value: "2 mins" },
        { label: "Success Rate", value: "100%" },
      ],
    },
    {
      title: "Multi-Crypto Support",
      description:
        "Compatible with major cryptocurrencies and stablecoins for flexible payments.",
      icon: CreditCard,
      gradient: "from-emerald-600 to-teal-400",
      detailedPoints: [
        "Support for ETH, USDC, DAI and StarkNet ecosystem tokens",
        "Real-time conversion rates through oracle integration",
        "Zero-slippage guarantees for stablecoin transactions",
      ],
      bgAccent: "bg-emerald-500/10",
      stats: [
        { label: "Currencies Supported", value: "15+" },
        { label: "Exchange Rates", value: "Real-time" },
      ],
    },
    {
      title: "DAO Governance",
      description:
        "Decentralized dispute resolution through community voting and arbitration.",
      icon: Users,
      gradient: "from-amber-600 to-orange-400",
      detailedPoints: [
        "Decentralized jury system with reputation-based selection",
        "Transparent voting process with all decisions on-chain",
        "Financial incentives for fair and timely arbitration",
      ],
      bgAccent: "bg-amber-500/10",
      stats: [
        { label: "Resolution Time", value: "48 hrs" },
        { label: "Disputes Resolved", value: "950+" },
      ],
    },
    {
      title: "Low Transaction Fees",
      description:
        "StarkNet's Layer 2 scalability delivers minimal gas costs compared to alternatives.",
      icon: Zap,
      gradient: "from-red-600 to-pink-400",
      detailedPoints: [
        "Up to 100x lower gas fees than Ethereum mainnet",
        "Batch processing for efficient transaction handling",
        "Predictable fee structure with no price spikes",
      ],
      bgAccent: "bg-red-500/10",
      stats: [
        { label: "Average Fee", value: "$0.01" },
        { label: "vs Competitors", value: "95% less" },
      ],
    },
    {
      title: "Real-time Updates",
      description:
        "Instant notifications and status tracking for all contract activities.",
      icon: Clock,
      gradient: "from-sky-600 to-blue-400",
      detailedPoints: [
        "WebSocket integration for real-time status changes",
        "Mobile and email notifications for critical events",
        "Timeline visualization of contract progress",
      ],
      bgAccent: "bg-sky-500/10",
      stats: [
        { label: "Update Latency", value: "<1 sec" },
        { label: "Uptime", value: "99.99%" },
      ],
    },
  ];

  const getAnimationDelay = (index: number): string => `${index * 100}ms`;

  return (
    <section
      id="features"
      className="relative py-20 bg-gray-900 overflow-hidden"
      ref={featuresRef}
    >
      {/* Background and blur elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20"></div>
        <div className="absolute inset-0 bg-[url('/hex-pattern.svg')] opacity-5"></div>
      </div>
      <div className="absolute top-40 right-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl"></div>

      {/* Content container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div
          className={`text-center mb-16 transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
        >
          <div className="inline-block mb-3">
            <div className="flex items-center justify-center space-x-2 bg-gray-800 bg-opacity-50 backdrop-blur-sm px-4 py-1 rounded-full">
              <Shield size={16} className="text-purple-400" />
              <span className="text-sm font-medium text-gray-300">
                Powered by StarkNet
              </span>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-white">Revolutionary </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              Features
            </span>
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Vaultix leverages StarkNet&apos;s cutting-edge technology to deliver a
            suite of powerful features that revolutionize freelance payments.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={`transition-all duration-700 transform ${isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                  }`}
                style={{ transitionDelay: getAnimationDelay(index) }}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div
                  className={`relative h-full ${feature.bgAccent
                    } rounded-2xl p-1 transition-all duration-300 ${hoveredFeature === index
                      ? "scale-105 shadow-lg shadow-purple-900/20"
                      : "scale-100"
                    }`}
                >
                  {/* Background Layers */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent via-gray-800 to-gray-800 z-0"></div>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 hover:opacity-30 transition-opacity duration-300 z-0 bg-gradient-to-r from-purple-500/30 to-blue-500/30"></div>

                  {/* Card Content */}
                  <div className="relative bg-gray-800 rounded-2xl p-6 md:p-8 h-full z-10 transition-all duration-300 flex flex-col">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient
                        } p-3 mb-6 transition-all duration-300 ${hoveredFeature === index ? "scale-110" : ""
                        }`}
                    >
                      <Icon size={32} className="text-white" />
                    </div>

                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-gray-400 mb-4">{feature.description}</p>

                    {/* Expanded Points */}
                    <div
                      className={`space-y-3 mb-6 transition-all duration-300 ${hoveredFeature === index
                          ? "max-h-40 opacity-100"
                          : "max-h-0 opacity-0 overflow-hidden"
                        }`}
                    >
                      {feature.detailedPoints.map((point, i) => (
                        <div key={i} className="flex items-start">
                          <div className="flex-shrink-0 mr-2 mt-1">
                            <div
                              className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${feature.gradient}`}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-300">{point}</p>
                        </div>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="mt-auto pt-4 border-t border-gray-700/50">
                      <div className="grid grid-cols-2 gap-4">
                        {feature.stats.map((stat, i) => (
                          <div key={i}>
                            <p className="text-xs text-gray-400">
                              {stat.label}
                            </p>
                            <p
                              className={`text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r ${feature.gradient}`}
                            >
                              {stat.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Button */}
      <div
        className={`text-center mt-16 transition-all duration-1000 delay-700 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
      >
        <button className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium transform transition-all duration-200 hover:scale-105">
          Explore All Features
        </button>
      </div>
    </section>
  );
}
