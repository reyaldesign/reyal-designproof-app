// Runs once when the server starts. It starts the uptime checks, the daily plugin read and the daily platform scan for the Websites tool.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startMonitor } = await import('./lib/websiteMonitor');
  startMonitor();
  (await import('./lib/mainwp')).startPluginSync();
  (await import('./lib/websitePlatform')).startPlatformScan();
}
