import { PAGE_AUTH } from "../lib/page";
import { SetupForm } from "../components/operators/AuthForms";

export default function SetupPage() {
  return (
    <main className={PAGE_AUTH}>
      <SetupForm />
    </main>
  );
}
