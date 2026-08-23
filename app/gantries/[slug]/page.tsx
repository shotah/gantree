import { AgentDashboard } from "../../components/crane/AgentDashboard";

export default async function GantryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 max-sm:px-4 max-sm:py-5">
      <AgentDashboard slug={slug} />
    </main>
  );
}
