This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More
## Docker

Build from this directory with browser-visible configuration provided as build
arguments:

```bash
docker build -t vaultix-frontend \
	--build-arg NEXT_PUBLIC_API_URL=http://localhost:3000 \
	--build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 \
	--build-arg NEXT_PUBLIC_WS_URL=http://localhost:3000 \
	--build-arg NEXT_PUBLIC_STELLAR_NETWORK=testnet \
	.
```

These `NEXT_PUBLIC_*` values are embedded in the browser bundle at build time;
changing them requires rebuilding the image, and they must not contain secrets.
Server-only environment variables are supplied at runtime with `docker run -e`
or Compose `environment`/`env_file` settings.

For the full local stack, use the root [Docker Compose setup](../../README.md#docker-local-full-stack).
It runs PostgreSQL, the API, and this frontend. Docker Engine works on Linux;
Docker Desktop works on macOS and Windows. On Windows, use WSL 2 integration and
a WSL shell, or adapt the Bash commands to PowerShell.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
