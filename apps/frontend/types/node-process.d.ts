// Minimal type definitions for Node.js process object
// This is needed for accessing environment variables in Next.js

interface NodeJSProcessEnv {
  [key: string]: string | undefined;
  NEXT_PUBLIC_API_URL?: string;
}

interface NodeJSProcess {
  env: NodeJSProcessEnv;
}

declare const process: NodeJSProcess;
