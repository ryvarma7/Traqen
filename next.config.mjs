/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Cache Router data payloads so repeat/back-forward navigation is instant.
    // Server actions call revalidatePath, which busts this cache on writes.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
