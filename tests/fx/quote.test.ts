// Cotizaciones (PAC-08, 29, 30, 31, 33, 34): conversión en bigint y elección de la mejor ruta.
// Las fuentes son dobles: no hay red.
import { describe, expect, it } from "vitest";
import {
  convertUnits,
  diffBasisPoints,
  formatBasisPoints,
  formatRate,
  parseRate,
  RATE_SCALE,
  rateToString,
} from "@/lib/fx/math";
import { getBestQuote, NoQuoteError, routeLabel } from "@/lib/fx/quote";
import {
  fiatCode,
  isFxCurrency,
  type RateSource,
  type RouteName,
} from "@/lib/fx/sources";

const rate = (text: string) => parseRate(text)!;

function fixedSource(name: RouteName, value: string | Error): RateSource {
  return {
    name,
    async getRate() {
      if (value instanceof Error) throw value;
      return rate(value);
    },
  };
}

describe("parseRate / rateToString", () => {
  it("convierte precios con decimales sin perder precisión", () => {
    expect(parseRate("280.842296")).toBe(BigInt("280842296000000"));
    expect(parseRate(0.003561)).toBe(BigInt("3561000000"));
    expect(rateToString(rate("280.842296"))).toBe("280.842296");
    expect(rateToString(rate("0.003561"))).toBe("0.003561");
  });

  it("rechaza lo que no es un precio positivo", () => {
    for (const value of [
      "",
      "abc",
      "-1",
      "0",
      "0.0",
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(parseRate(value)).toBeNull();
    }
  });
});

describe("convertUnits", () => {
  it("convierte montos de 18 decimales con bigint", () => {
    const sixHundred = BigInt(600) * BigInt(10) ** BigInt(18);
    const converted = convertUnits(sixHundred, rate("245.3"));
    expect(converted).toBe(BigInt(147180) * BigInt(10) ** BigInt(18));
  });

  it("con rate 1 devuelve el mismo monto", () => {
    expect(convertUnits(BigInt(12345), RATE_SCALE)).toBe(BigInt(12345));
  });
});

describe("formateo para pantalla", () => {
  it("usa coma decimal y puntos de miles", () => {
    expect(formatRate(rate("280.842296"))).toBe("280,84");
    expect(formatRate(rate("1234.5"))).toBe("1.234,50");
  });

  it("muestra más decimales cuando el precio es chico", () => {
    expect(formatRate(rate("0.003561"))).toBe("0,003561");
    expect(formatRate(rate("0.2"))).toBe("0,2000");
  });

  it("da la diferencia contra la referencia con signo", () => {
    expect(diffBasisPoints(rate("101"), rate("100"))).toBe(100);
    expect(diffBasisPoints(rate("99"), rate("100"))).toBe(-100);
    expect(formatBasisPoints(100)).toBe("+1,0 %");
    expect(formatBasisPoints(-45)).toBe("-0,5 %");
    expect(formatBasisPoints(0)).toBe("0,0 %");
  });
});

describe("getBestQuote", () => {
  it("elige la ruta real que más paga y la compara con la referencia", async () => {
    const quote = await getBestQuote("wBRL", "wARS", [
      fixedSource("reference", "280"),
      fixedSource("textile", "282.8"),
      fixedSource("dex", "281"),
    ]);
    expect(quote.route).toBe("textile");
    expect(quote.rate).toBe(rate("282.8"));
    expect(quote.referenceRate).toBe(rate("280"));
    expect(quote.diffBasisPoints).toBe(100);
  });

  it("si las rutas reales fallan, usa la referencia", async () => {
    const quote = await getBestQuote("wBRL", "wARS", [
      fixedSource("textile", new Error("sin credenciales")),
      fixedSource("dex", new Error("sin pools")),
      fixedSource("reference", "280"),
    ]);
    expect(quote).toMatchObject({ route: "reference", diffBasisPoints: 0 });
  });

  it("si la referencia falla pero una ruta real contesta, la usa sin comparación", async () => {
    const quote = await getBestQuote("wBRL", "wARS", [
      fixedSource("textile", "282"),
      fixedSource("reference", new Error("caída")),
    ]);
    expect(quote).toMatchObject({
      route: "textile",
      referenceRate: null,
      diffBasisPoints: null,
    });
  });

  it("si no contesta nadie, avisa con NoQuoteError", async () => {
    await expect(
      getBestQuote("wBRL", "wARS", [
        fixedSource("reference", new Error("caída")),
      ]),
    ).rejects.toBeInstanceOf(NoQuoteError);
  });

  it("con la misma moneda de los dos lados no consulta a nadie", async () => {
    const quote = await getBestQuote("wARS", "wARS", [
      fixedSource("reference", new Error("no debería llamarse")),
    ]);
    expect(quote.rate).toBe(RATE_SCALE);
  });
});

describe("monedas y rutas", () => {
  it("reconoce solo las tres monedas de Ripio", () => {
    expect(isFxCurrency("wBRL")).toBe(true);
    expect(isFxCurrency("USD")).toBe(false);
    expect(isFxCurrency(undefined)).toBe(false);
    expect(fiatCode("wMXN")).toBe("MXN");
  });

  it("tiene nombre legible para cada ruta", () => {
    expect(routeLabel("reference")).toBe("precio de referencia");
    expect(routeLabel("textile")).toBe("Textile");
  });
});
