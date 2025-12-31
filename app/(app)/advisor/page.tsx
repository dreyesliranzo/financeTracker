import { AdvisorChat } from "@/components/chat/AdvisorChat";

export default function AdvisorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Advisor</h1>
        <p className="text-sm text-muted-foreground">
          Get quick recommendations based on your recent activity.
        </p>
      </div>
      <AdvisorChat />
    </div>
  );
}
