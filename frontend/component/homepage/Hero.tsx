"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const Hero: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center overflow-hidden bg-gray-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-full h-full bg-[radial-gradient(circle_at_20%_120%,#3490dc_0%,transparent_50%)]"></div>
        <div className="absolute w-full h-full bg-[radial-gradient(circle_at_80%_20%,#7e22ce_0%,transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20"></div>

        {/* Animated hexagons */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 border border-blue-500/20 rounded-full animate-pulse"></div>
          <div
            className="absolute top-3/4 left-2/3 w-48 h-48 border border-purple-500/20 rounded-full animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
          <div
            className="absolute top-1/2 left-1/3 w-96 h-96 border border-teal-500/20 rounded-full animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        {/* Floating blockchain elements */}
        <div className="absolute top-20 left-20 w-24 h-24 rotate-45 border border-blue-500/30 rounded-lg backdrop-blur-sm animate-float"></div>
        <div
          className="absolute bottom-40 right-20 w-16 h-16 rotate-12 border border-purple-500/30 rounded-lg backdrop-blur-sm animate-float"
          style={{ animationDelay: "1.5s" }}
        ></div>
        <div
          className="absolute top-1/2 right-1/3 w-20 h-20 -rotate-12 border border-teal-500/30 rounded-lg backdrop-blur-sm animate-float"
          style={{ animationDelay: "2.5s" }}
        ></div>
      </div>

      {/* Hero content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div
            className={`transition-all duration-1000 transform ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold">
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400">
                Secure Freelance
              </span>
              <span className="block text-white mt-1">Powered by Stellar</span>
            </h1>
            <p className="mt-6 text-xl text-gray-300 max-w-lg">
              The decentralized escrow service protecting freelancers and
              clients with smart contract security and DAO governance.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/app"
                className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-full font-medium text-center sm:text-left transition-all duration-200 ease-in-out transform hover:scale-105"
              >
                Get Started
              </Link>
              <Link
                href="#how-it-works"
                className="flex-1 sm:flex-none bg-transparent border border-gray-500 hover:border-white text-white px-8 py-3 rounded-full font-medium text-center sm:text-left transition-all duration-200"
              >
                Learn More
              </Link>
            </div>
            <div className="mt-6 flex items-center text-sm text-gray-400">
              <svg
                className="h-5 w-5 mr-2 text-teal-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Built on Stellar for maximal security and scalability
            </div>
          </div>

          <div
            className={`relative transition-all duration-1000 delay-300 transform ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-gray-800 overflow-hidden p-1">
              <div className="relative">
                {/* Code-like visualization */}
                <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm overflow-hidden">
                  <div className="flex items-center mb-4">
                    <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="ml-4 text-gray-400">
                      Vaultix Smart Contract
                    </span>
                  </div>
                  <div className="space-y-2 text-gray-300">
                    <div>
                      <span className="text-blue-400">contract</span>{" "}
                      <span className="text-green-400">Vaultix</span> {"{"}
                    </div>
                    <div className="pl-4">
                      <span className="text-purple-400">mapping</span>(address
                      =`&gt; <span className="text-yellow-400">uint256</span>){" "}
                      <span className="text-teal-400">balances</span>;
                    </div>
                    <div className="pl-4">
                      <span className="text-purple-400">struct</span>{" "}
                      <span className="text-yellow-400">Escrow</span> {"{"}
                    </div>
                    <div className="pl-8">
                      <span className="text-teal-400">address</span> client;
                    </div>
                    <div className="pl-8">
                      <span className="text-teal-400">address</span> freelancer;
                    </div>
                    <div className="pl-8">
                      <span className="text-teal-400">uint256</span> amount;
                    </div>
                    <div className="pl-8">
                      <span className="text-teal-400">uint256</span> deadline;
                    </div>
                    <div className="pl-8">
                      <span className="text-teal-400">bool</span> completed;
                    </div>
                    <div className="pl-4">{"}"}</div>
                    <div className="pl-4">
                      <span className="text-blue-400">function</span>{" "}
                      <span className="text-green-400">createEscrow</span>(
                      <span className="text-teal-400">address</span>{" "}
                      _freelancer){" "}
                    </div>
                    <div className="pl-4">
                      <span className="text-blue-400">function</span>{" "}
                      <span className="text-green-400">releasePayment</span>(
                      <span className="text-teal-400">uint256</span> _id)
                    </div>
                    <div className="pl-4">
                      <span className="text-blue-400">function</span>{" "}
                      <span className="text-green-400">initiateDispute</span>(
                      <span className="text-teal-400">uint256</span> _id)
                    </div>
                    <div>{"}"}</div>
                  </div>

                  {/* Animated cursor */}
                  <div className="absolute bottom-6 left-[260px] h-4 w-2 bg-white opacity-70 animate-blink"></div>
                </div>

                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full opacity-70 blur-lg"></div>
                <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-gradient-to-tr from-blue-500 to-teal-500 rounded-full opacity-70 blur-lg"></div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-800 p-4">
                <div className="text-sm text-gray-400">Transaction Fee</div>
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  5x Lower
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  than traditional platforms
                </div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-800 p-4">
                <div className="text-sm text-gray-400">Security Rating</div>
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">
                  99.9%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  audited by CertiK
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
