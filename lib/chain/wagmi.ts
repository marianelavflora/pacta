import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo, celoSepolia } from "viem/chains";
import { getChain } from "@/lib/chain/chains";

// Config de wagmi para el NAVEGADOR. Solo conecta la billetera de la persona
// (MetaMask, MiniPay, Valora). No maneja claves ni manda transacciones.
// La red sale de NEXT_PUBLIC_CHAIN vía chains.ts; nunca se escribe fija acá.

export function createWagmiConfig() {
  const active = getChain();
  const chains = active.id === celo.id ? ([celo] as const) : ([celoSepolia] as const);
  const transports = {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  } as const;
  return createConfig({
    chains,
    connectors: [injected()],
    transports,
    ssr: true,
  });
}

export type AppWagmiConfig = ReturnType<typeof createWagmiConfig>;
