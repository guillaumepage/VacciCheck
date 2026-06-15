import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vaccicheck")({
  component: VacciCheckPage,
});

function VacciCheckPage() {
  return (
    <iframe
      src="/vaccicheck-app.html"
      title="VacciCheck"
      className="w-screen border-0 -mx-4"
      style={{ height: "calc(100vh - 3.5rem - 4rem)", width: "calc(100% + 2rem)" }}
    />
  );
}
