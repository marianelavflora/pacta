import type { Metadata } from "next";
import { FilePlus2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Crear acuerdo",
  description: "Armá el acuerdo con tu cliente: el trabajo, los hitos y cuánto vale cada uno.",
};

/**
 * Crear acuerdo (boceto 03-04).
 * Lo llenan:
 * - PAC-16 (#16): formulario con los datos del trabajo.
 * - PAC-17 (#17): lista de hitos.
 * - PAC-18 (#18): guardar y compartir el link con el cliente.
 * - PAC-37 (#37): pantalla de intake con Claude.
 */
export default function NewAgreementPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Crear acuerdo"
        description="Contá qué trabajo vas a hacer, dividilo en hitos y poné cuánto vale cada uno. Después le pasás el link a tu cliente."
      />

      {/* PAC-16 y PAC-17: acá va el formulario del acuerdo y sus hitos. */}
      <EmptyState
        icon={FilePlus2}
        title="Muy pronto vas a poder armar tu acuerdo acá"
        text="Vas a cargar el trabajo, los hitos y la moneda en la que cobrás. Pactá se encarga del resto."
      />
    </div>
  );
}
