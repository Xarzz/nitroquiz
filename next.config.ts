import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/join/:roomCode',
        destination: '/player/:roomCode/join',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
