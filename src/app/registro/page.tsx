import RegisterForm from "./RegisterForm";
import { AppShell } from "@/components/layout/AppShell";

export default function RegisterPage() {
  return (
    <AppShell isAuthenticated={false}>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <RegisterForm />
      </main>
    </AppShell>
  );
}
