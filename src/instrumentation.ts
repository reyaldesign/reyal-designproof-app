// Runs once when the server starts. It starts the uptime checks for the Websites tool.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startMonitor } = await import('./lib/websiteMonitor');
  startMonitor();
}
