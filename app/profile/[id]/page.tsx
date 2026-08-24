import { OperatorProfile } from "../../components/operators/OperatorProfile";

export default async function OperatorEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto min-w-0 max-w-6xl px-6 py-8 max-sm:px-4 max-sm:py-5">
      <OperatorProfile operatorId={id} />
    </main>
  );
}
