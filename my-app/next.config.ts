import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
<<<<<<< HEAD
  /* config options here */
  
  // Enable experimental features for better production builds
  experimental: {
    // Optimize package imports for faster builds
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },
  
  // Handle server-side environment variables for API routes
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  
  // Configure image domains if using external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
=======
  outputFileTracingRoot: path.join(process.cwd()),
>>>>>>> ulit
};

export default nextConfig;
