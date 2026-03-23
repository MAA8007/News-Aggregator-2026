/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow images from any external hostname (articles come from many sources)
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
