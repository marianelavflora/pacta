// Compila contracts/TestToken.sol con solc (npm) y escribe lib/chain/artifacts/TestToken.json.
// Uso: npm run compile:tokens   (el resultado está commiteado; solo se corre si cambia el .sol)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const solc = require("solc");

const input = {
  language: "Solidity",
  sources: { "TestToken.sol": { content: readFileSync("contracts/TestToken.sol", "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import: (p) => ({ contents: readFileSync(`node_modules/${p}`, "utf8") }),
  }),
);
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
const c = out.contracts["TestToken.sol"].TestToken;
writeFileSync(
  "lib/chain/artifacts/TestToken.json",
  JSON.stringify({ solc: solc.version(), abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2) + "\n",
);
console.log("OK", solc.version());
