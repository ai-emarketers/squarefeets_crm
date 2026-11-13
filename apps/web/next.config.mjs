// Next.js configuration.
// The browser always calls the API at the SAME address as the website (/api/...). Next.js forwards those calls
// to the real API server (API_INTERNAL_URL, default http://localhost:4000). Benefits: no CORS set-up, and the
// CRM also works when opened from a phone or another PC on your network (http://<your-pc-ip>:3000).

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,   // extra development-time checks
  poweredByHeader: false,  // don't advertise 'X-Powered-By: Next.js'
  // Forward /api/* from the web app to the API service so the browser talks to one origin.
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '');
    // /api/anything on the website  ->  <API server>/api/anything
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};
export default nextConfig;
