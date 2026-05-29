import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="max-w-xl w-full bg-white border border-gray-200 rounded-3xl shadow-xl p-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-lg text-gray-600">
          The link you followed appears to be invalid or expired.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          If you were trying to access an escrow or invitation, please make sure the URL is correct.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
