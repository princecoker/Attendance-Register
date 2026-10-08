import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, serverExternalPackages: ['pg'], experimental: { cpus: 2 } };
export default config;
