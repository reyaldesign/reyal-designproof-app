// The public address nginx serves this app on. Server Actions (every form) are rejected if the browser's origin is not recognised.
const publicHost = (() => {
  try { return new URL(process.env.APP_URL || '').host; } catch { return ''; }
})();

export default {
  serverExternalPackages: ['mupdf'],
  experimental: {
    serverActions: {
      bodySizeLimit: '60mb',
      allowedOrigins: [publicHost, 'client.reyaldesign.com', 'localhost:3100', 'localhost:3000'].filter(Boolean),
    },
  },
};
