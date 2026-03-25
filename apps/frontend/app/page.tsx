
import Image from "next/image";
  import Link from "next/link";

export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="flex items-center">
          <div className="h-16 w-16 relative mr-4">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg transform rotate-45"></div>
            <div className="absolute inset-1 bg-black rounded-lg transform flex items-center justify-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-2xl">
                V
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-500 to-teal-400">
            Vaultix
          </h1>
        </div>
        
        <div className="text-center max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Secure Decentralized Escrow Platform
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Protect your transactions with smart escrow agreements powered by Stellar blockchain technology.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium text-lg px-8 py-3 transition-all duration-200 ease-in-out transform hover:scale-105 shadow-lg"
            >
              Access Dashboard
            </Link>
            <Link
              href="/escrow/create"
              className="rounded-full border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium text-lg px-8 py-3 transition-all duration-200 ease-in-out transform hover:scale-105"
            >
              Create Escrow
            </Link>
          </div>
        </div>
          
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 max-w-4xl">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="text-blue-600 text-3xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Transactions</h3>
            <p className="text-gray-600">Smart contracts ensure funds are only released when conditions are met</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="text-purple-600 text-3xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Fast Settlement</h3>
            <p className="text-gray-600">Blockchain-powered transactions settle in seconds, not days</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="text-teal-600 text-3xl mb-4">🌐</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Global Access</h3>
            <p className="text-gray-600">Access your escrow agreements from anywhere in the world</p>
          
          </div>
        </div>
      </main>
      
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="/dashboard"
        >
          Dashboard
        </Link>
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="/escrow/create"
        >
          Create Escrow
        </Link>
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://github.com/Vaultix"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </Link>
      </footer>
    </div>
  );
}