import { PAGE_AUTH } from "../lib/page";
import { SetupForm } from "../components/operators/AuthForms";

export default function SetupPage() {
  return (
    <main className="min-w-0">
      <div className={PAGE_AUTH}>
        <SetupForm />
      </div>
    </main>
  );
}
