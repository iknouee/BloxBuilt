/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Build images come from Vercel Blob and (optionally) external URLs, so we
    // allow remote images broadly. Next's <Image> isn't used for user content
    // to keep uploads flexible, but this keeps the door open.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
