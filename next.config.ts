import type { NextConfig } from "next";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "testologia.ru",
        port: "",
        pathname: "/cars-images/**",
      },
    ],
  },
};
export default nextConfig;
