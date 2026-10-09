import { aiKeyConfigured, aiModel, requireAi } from '@/lib/ai';
import { loadAiClients } from '@/lib/aiData';
import ReviewApp from './ReviewApp';

export default async function AiReviewPage() {
  await requireAi('AI_REVIEW');
  const clients = await loadAiClients();
  return (
    <ReviewApp
      clients={clients}
      keyConfigured={aiKeyConfigured()}
      model={aiModel()}
      price={{ in: Number(process.env.PRICE_PER_MTOK_INPUT || 2.0), out: Number(process.env.PRICE_PER_MTOK_OUTPUT || 10.0) }}
    />
  );
}
