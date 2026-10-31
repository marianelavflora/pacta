import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function AgreementNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="No encontramos este acuerdo"
      text="Revisá que el link esté completo o pedile uno nuevo a quien te lo mandó."
    >
      <Button asChild>
        <Link href={routes.home}>Ir al inicio</Link>
      </Button>
    </EmptyState>
  );
}
