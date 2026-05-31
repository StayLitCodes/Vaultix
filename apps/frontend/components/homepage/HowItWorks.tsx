"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  ArrowRight,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  LucideIcon,
} from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  details: string[];
  color: string;
  animation: string;
}

const HowItWorks: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 },
    );

    const section = document.getElementById("how-it-works-section");
    if (section) observer.observe(section);

    return () => {
      if (section) observer.unobserve(section);
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      const timer = setInterval(() => {
        setActiveStep((prev: number) => (prev === 3 ? 0 : prev + 1));
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [isVisible]);

  const steps: Step[] = [
    {
      icon: Shield,
      title: "Client Deposits Funds",
      description:
        "Client securely locks payment in a StarkNet smart contract escrow.",
      details: [
        "Funds remain inaccessible to both parties until conditions are met",
        "Multiple cryptocurrency assets supported",
        "Zero risk of payment disputes after work completion",
      ],
      color: "from-blue-500 to-cyan-500",
      animation: "translate-x-0 translate-y-0",
    },
    {
      icon: Briefcase,
      title: "Freelancer Completes Work",
      description: "Freelancer delivers the project according to agreed terms.",
      details: [
        "Work with confidence knowing payment is already secured",
        "Submit deliverables through integrated verification system",
        "Automatic deadline tracking with smart contract enforcement",
      ],
      color: "from-purple-500 to-indigo-500",
      animation: "translate-y-2 translate-x-1",
    },
    {
      icon: CheckCircle,
      title: "Client Approves & Releases",
      description: "Client reviews and approves, triggering automatic payment.",
      details: [
        "Multi-signature release ensures security",
        "Instant transfer to freelancer's wallet upon approval",
        "Transaction fees 5x lower than traditional platforms",
      ],
      color: "from-green-500 to-emerald-500",
      animation: "translate-y-0 translate-x-2",
    },
    {
      icon: AlertTriangle,
      title: "Dispute Resolution",
      description: "If needed, DAO voting system fairly resolves any disputes.",
      details: [
        "Decentralized community governance",
        "Neutral third-party arbitration",
        "Transparent and immutable decision records on StarkNet",
      ],
      color: "from-amber-500 to-orange-500",
      animation: "translate-y-1 translate-x-0",
    },
  ];

  return (
    <section
      id="how-it-works-section"
      className="relative py-20 bg-gray-900 overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-full h-full bg-[radial-gradient(circle_at_10%_90%,#3b82f6_0%,transparent_30%)]"></div>
        <div className="absolute w-full h-full bg-[radial-gradient(circle_at_90%_20%,#7e22ce_0%,transparent_30%)]"></div>
        <div className="absolute inset-0 bg-[url('/circuit-pattern.svg')] opacity-10"></div>
      </div>

      {/* Hexagon Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-1/4 w-32 h-32 border border-blue-500/20 rotate-45"></div>
        <div className="absolute bottom-20 right-1/3 w-48 h-48 border border-purple-500/20 rotate-45"></div>
        <div className="absolute top-1/2 left-10 w-24 h-24 border border-teal-500/20 rotate-45"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div
          className={`text-center mb-16 transition-all duration-1000 transform ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              How Vaultix Works
            </span>
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Our StarkNet-powered escrow system provides security and peace of
            mind for both freelancers and clients.
          </p>
        </div>

        {/* Process Flow - Desktop */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connection Lines */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 transform -translate-y-1/2 opacity-30"></div>

            {/* Timeline Steps */}
            <div className="grid grid-cols-4 gap-6 relative">
              {steps.map((step: Step, index: number) => {
                const StepIcon = step.icon;
                return (
                  <div
                    key={index}
                    className={`transition-all duration-500 transform ${
                      isVisible
                        ? `opacity-100 translate-y-0 delay-${index * 200}`
                        : "opacity-0 translate-y-10"
                    } ${
                      activeStep === index
                        ? "scale-105 z-10"
                        : "scale-100 opacity-70"
                    }`}
                  >
                    <div
                      className={`bg-gray-800 backdrop-blur-sm rounded-xl border border-gray-700 p-6 h-full shadow-lg ${
                        activeStep === index
                          ? "ring-2 ring-offset-2 ring-offset-gray-900 ring-purple-500"
                          : ""
                      }`}
                    >
                      {/* Step Number */}
                      <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>

                      {/* Icon */}
                      <div
                        className={`w-14 h-14 rounded-lg bg-gradient-to-br ${
                          step.color
                        } p-3 mx-auto mb-4 transform ${
                          activeStep === index ? "scale-110" : "scale-100"
                        } transition-all duration-300`}
                      >
                        <StepIcon className="w-full h-full text-white" />
                      </div>

                      {/* Content */}
                      <h3 className="text-xl font-bold text-center mb-3">
                        {step.title}
                      </h3>
                      <p className="text-gray-400 text-center mb-4">
                        {step.description}
                      </p>

                      {/* Details */}
                      <ul
                        className={`space-y-2 opacity-0 h-0 overflow-hidden transition-all duration-300 ${
                          activeStep === index ? "opacity-100 h-auto" : ""
                        }`}
                      >
                        {step.details.map((detail: string, i: number) => (
                          <li key={i} className="flex items-start">
                            <span className="text-purple-400 mr-2">•</span>
                            <span className="text-gray-300 text-sm">
                              {detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Connection Arrow */}
                    {index < steps.length - 1 && (
                      <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 z-20">
                        <div className="bg-gray-800 rounded-full p-1">
                          <ArrowRight className="w-4 h-4 text-purple-400" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Process Flow - Mobile */}
        <div className="md:hidden">
          <div className="space-y-8">
            {steps.map((step: Step, index: number) => {
              const StepIcon = step.icon;
              const isActive: boolean = activeStep === index;

              return (
                <div
                  key={index}
                  className={`relative transition-all duration-500 transform ${
                    isVisible
                      ? `opacity-100 translate-y-0 delay-${index * 100}`
                      : "opacity-0 translate-y-10"
                  } ${isActive ? "scale-105" : "scale-100"}`}
                  onClick={() => setActiveStep(index)}
                >
                  <div
                    className={`bg-gray-800 rounded-xl border border-gray-700 p-6 ${
                      isActive ? "ring-2 ring-purple-500" : ""
                    }`}
                  >
                    {/* Left Vertical Line */}
                    {index !== 0 && (
                      <div className="absolute top-0 left-8 w-0.5 h-8 bg-gradient-to-b from-transparent to-purple-500 -translate-y-full"></div>
                    )}

                    {/* Bottom Vertical Line */}
                    {index !== steps.length - 1 && (
                      <div className="absolute bottom-0 left-8 w-0.5 h-8 bg-gradient-to-b from-purple-500 to-transparent translate-y-full"></div>
                    )}

                    <div className="flex items-start">
                      {/* Circle and Icon */}
                      <div className="mr-4">
                        <div
                          className={`w-16 h-16 rounded-lg bg-gradient-to-br ${step.color} p-3 transform transition-all duration-300`}
                        >
                          <StepIcon className="w-full h-full text-white" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-xs font-bold mr-2">
                            {index + 1}
                          </div>
                          <h3 className="text-lg font-bold">{step.title}</h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-3">
                          {step.description}
                        </p>

                        {/* Details */}
                        <ul
                          className={`space-y-2 max-h-0 overflow-hidden transition-all duration-300 ${
                            isActive ? "max-h-40" : ""
                          }`}
                        >
                          {step.details.map((detail: string, i: number) => (
                            <li key={i} className="flex items-start">
                              <span className="text-purple-400 mr-2">•</span>
                              <span className="text-gray-300 text-xs">
                                {detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex justify-center mt-10">
          {steps.map((_: Step, index: number) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`w-3 h-3 rounded-full mx-2 transition-all duration-300 ${
                activeStep === index ? "bg-purple-500 scale-125" : "bg-gray-600"
              }`}
              aria-label={`View step ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Decoration */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 100"
          className="w-full h-20"
        >
          <path
            fill="#111827"
            fillOpacity="1"
            d="M0,32L60,37.3C120,43,240,53,360,58.7C480,64,600,64,720,53.3C840,43,960,21,1080,16C1200,11,1320,21,1380,26.7L1440,32L1440,100L1380,100C1320,100,1200,100,1080,100C960,100,840,100,720,100C600,100,480,100,360,100C240,100,120,100,60,100L0,100Z"
          ></path>
        </svg>
      </div>
    </section>
  );
};

export default HowItWorks;
