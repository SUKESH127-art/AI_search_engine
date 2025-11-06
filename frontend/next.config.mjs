/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed output: 'export' for development
  // If you need static export for production, uncomment the line below
  // output: 'export', // Outputs a Single-Page Application (SPA).
  distDir: './dist', // Changes the build output directory to `./dist`.
  devIndicators: {
    buildActivity: false,
    appIsrIndicator: false,
  },
}

export default nextConfig
