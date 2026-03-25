/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const generatePWA = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  /* config options here */
};

export default generatePWA(nextConfig);
