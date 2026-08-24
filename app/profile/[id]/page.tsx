import { OperatorProfile } from "../../components/operators/OperatorProfile";

export default async function OperatorEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-w-0">
      <OperatorProfile operatorId={id} />
    </main>
  );
}
