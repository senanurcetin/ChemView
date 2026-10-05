import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Genkit pulls in optional OpenTelemetry exporters; keep it out of the webpack bundle.
  serverExternalPackages: ['genkit', '@genkit-ai/core', '@genkit-ai/google-genai', '@opentelemetry/sdk-node'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
