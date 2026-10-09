import { loadAiClients } from '@/lib/aiData';
import ClientsManager from './ClientsManager';

export default async function AiClientsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return <ClientsManager clients={await loadAiClients()} selectedId={c} />;
}
