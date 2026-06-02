import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 text-white overflow-hidden">
      {/* Hexagon Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-6 md:grid-cols-12 gap-4">
          {Array(48)
            .fill(undefined)
            .map((_, i: number) => (
              <div
                key={i}
                className="aspect-square border border-purple-500 rotate-45 opacity-30"
              ></div>
            ))}
        </div>
      </div>

      {/* Particle Network Effect */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="w-2 h-2 rounded-full bg-blue-400 absolute top-1/4 left-1/3 animate-pulse"></div>
        <div className="w-2 h-2 rounded-full bg-purple-400 absolute top-1/2 left-1/4 animate-pulse"></div>
        <div className="w-2 h-2 rounded-full bg-indigo-400 absolute top-3/4 left-1/2 animate-pulse"></div>
        <div className="w-2 h-2 rounded-full bg-blue-400 absolute top-1/3 left-2/3 animate-pulse"></div>
        <div className="w-2 h-2 rounded-full bg-purple-400 absolute top-2/3 left-3/4 animate-pulse"></div>
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Logo and Tagline */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div className="mb-6 md:mb-0">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h2 className="ml-3 text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                Stellar Project
              </h2>
            </div>
            <p className="mt-2 text-gray-400 max-w-md">
              Building the future of decentralized applications powered by
              Stellar&apos;s revolutionary Layer 2 technology.
            </p>
          </div>

          {/* Newsletter */}
          <div className="w-full md:w-auto">
            <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-sm p-4 rounded-lg border border-gray-700">
              <h3 className="text-lg font-medium mb-2">Stay up to date</h3>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Your email"
                  className="bg-gray-900 text-white px-4 py-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-purple-500 w-full md:w-64"
                />
                <button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-r-md transition duration-300">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Documentation */}
          <div>
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-purple-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              Documentation
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/docs/getting-started">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-purple-500 rounded-full mr-2"></span>
                    Getting Started
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/docs/smart-contracts">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-purple-500 rounded-full mr-2"></span>
                    Smart Contracts
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/docs/cairo">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-purple-500 rounded-full mr-2"></span>
                    Cairo Language
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/docs/tutorials">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-purple-500 rounded-full mr-2"></span>
                    Tutorials
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/support/faq">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-blue-500 rounded-full mr-2"></span>
                    FAQs
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/support/contact">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-blue-500 rounded-full mr-2"></span>
                    Contact Us
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/support/discord">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-blue-500 rounded-full mr-2"></span>
                    Discord Community
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/support/bug-bounty">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-blue-500 rounded-full mr-2"></span>
                    Bug Bounty
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z"
                  clipRule="evenodd"
                />
              </svg>
              Legal
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/legal/terms">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-green-500 rounded-full mr-2"></span>
                    Terms of Service
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-green-500 rounded-full mr-2"></span>
                    Privacy Policy
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/legal/disclaimer">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-green-500 rounded-full mr-2"></span>
                    Disclaimer
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/legal/cookies">
                  <span className="text-gray-300 hover:text-white transition duration-300 flex items-center">
                    <span className="h-1 w-1 bg-green-500 rounded-full mr-2"></span>
                    Cookie Policy
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-pink-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Connect
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="https://twitter.com/starknet"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="flex items-center justify-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition duration-300">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.053 10.053 0 01-3.127 1.184 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </span>
              </Link>
              <Link
                href="https://discord.gg/starknet"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="flex items-center justify-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition duration-300">
                  <svg
                    className="h-6 w-6 text-indigo-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3847-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                  </svg>
                </span>
              </Link>
              <Link
                href="https://github.com/starkware-libs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="flex items-center justify-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition duration-300">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.4716 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                </span>
              </Link>
              <Link
                href="https://telegram.me/starknet"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="flex items-center justify-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition duration-300">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </span>
              </Link>
            </div>

            {/* Community Stats */}
            <div className="mt-6 bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-sm p-4 rounded-lg border border-gray-700">
              <h4 className="font-medium text-gray-300 mb-2">
                Stellar Ecosystem
              </h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2">
                  <p className="text-2xl font-bold text-blue-400">2.5M+</p>
                  <p className="text-xs text-gray-400">Transactions</p>
                </div>
                <div className="p-2">
                  <p className="text-2xl font-bold text-purple-400">500+</p>
                  <p className="text-xs text-gray-400">dApps</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm order-2 md:order-1 mt-4 md:mt-0">
            © {new Date().getFullYear()} Stellar Project. All rights reserved.
          </p>

          {/* Bottom Links */}
          <div className="flex space-x-6 order-1 md:order-2">
            <a
              href="#"
              className="text-gray-400 hover:text-white transition duration-300 text-sm"
            >
              Status
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition duration-300 text-sm"
            >
              Developers
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition duration-300 text-sm"
            >
              Roadmap
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition duration-300 text-sm"
            >
              Careers
            </a>
          </div>
        </div>
      </div>

      {/* Blockchain Animation */}
      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden">
        <div className="h-full w-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse"></div>
      </div>
    </footer>
  );
};

export default Footer;
