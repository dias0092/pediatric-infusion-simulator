import { ScenarioList } from '@/components/screens/ScenarioList';

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mode } = await searchParams;
  return <ScenarioList mode={mode === 'exam' ? 'exam' : 'learning'} />;
}
