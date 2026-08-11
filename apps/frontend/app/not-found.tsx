import Link from "next/link";
import { FileQuestion, Home, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] bg-background text-foreground flex flex-col items-center justify-center px-4 text-center py-16">
      <div className="max-w-md w-full space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center border border-blue-200 dark:border-blue-800">
          <FileQuestion className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold tracking-wider uppercase text-blue-600 dark:text-blue-400">
            404 Error
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Page Not Found
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Sorry, we couldn’t find the page you’re looking for. It might have been moved or deleted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link href="/dashboard" passHref>
            <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/" passHref>
            <Button variant="outline" className="w-full sm:w-auto flex items-center justify-center gap-2">
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
