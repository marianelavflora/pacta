import type { Metadata } from "next";
import { AgreementForm } from "@/components/agreement-form/AgreementForm";
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
 * - PAC-37 (#37): pantalla de intake con IA (`IntakeChat`, paso 1 de 3).
 */
export default function NewAgreementPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Crear acuerdo"
        description="Contale el trabajo al agente, revisá los hitos que arma y mandale el link a tu cliente. Son tres pasos."
      />

      <AgreementForm />
    </div>
  );
}
