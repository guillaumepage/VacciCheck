import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vaccicheck")({
  component: VacciCheckPage,
});

function VacciCheckPage() {
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-4rem)]">
      <iframe
        src="/vaccicheck-app.html"
        title="VacciCheck"
        className="w-full h-full border-0"
        // sandbox left permissive so embedded pdf.js + scripts run
      />
    </div>
  );
}
