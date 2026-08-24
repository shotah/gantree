import { PAGE_AUTH } from "../lib/page";
import { LoginForm } from "../components/operators/AuthForms";

export default function LoginPage() {
  return (
    <main className="min-w-0">
      <div className={PAGE_AUTH}>
        <LoginForm />
      </div>
    </main>
  );
}
