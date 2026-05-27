import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Prefer AVIF (smaller than WebP) for images that go through next/image.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // User-pasted external avatar / NPC image hosts.
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: 'i.postimg.cc' },
      { protocol: 'https', hostname: 'iili.io' },
      { protocol: 'https', hostname: 'img.freepik.com' },
      { protocol: 'https', hostname: 'img.magnific.com' },
    ],
  },
}

export default nextConfig
