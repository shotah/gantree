import { AgentDashboard } from "../../components/crane/AgentDashboard";

export default async function GantryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="min-w-0">
      <AgentDashboard slug={slug} />
    </main>
  );
}
