import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "No encontramos esta página",
};

/** Se muestra cuando la dirección no existe (o cuando una página llama a `notFound()`). */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <EmptyState
        icon={SearchX}
        title="No encontramos esta página"
        text="Puede que el link esté incompleto o que ya no exista. Revisalo o volvé al inicio."
      >
        <Button asChild className="mt-2">
          <Link href={routes.home}>Volver al inicio</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
