import { notFound } from 'next/navigation';
import { SimulationScreen } from '@/components/sim/SimulationScreen';
import { getScenario } from '@/lib/scenarios';

export default async function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scenarioId } = await params;
  const { mode } = await searchParams;
  if (!getScenario(scenarioId)) notFound();
  return <SimulationScreen scenarioId={scenarioId} mode={mode === 'exam' ? 'exam' : 'learning'} />;
}
