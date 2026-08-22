import { AgentDashboard } from "../../components/AgentDashboard";

export default async function GantryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <AgentDashboard slug={slug} />
    </main>
  );
}
