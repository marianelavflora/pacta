// Textos de la página "Cómo funciona" (PAC-48). Van acá, y no dentro de la página,
// para poder testear que estén en castellano simple y sin jerga (ver tests/ui-how-it-works.test.ts).

export type Step = { title: string; text: string };

/** Pasos para quien cobra. */
export const freelancerSteps: readonly Step[] = [
  {
    title: "Armás el acuerdo",
    text: "Contás el trabajo, los hitos (las entregas por partes), cuánto vale cada uno y en cuánto tiempo se revisan. Conectás tu billetera para recibir los pagos.",
  },
  {
    title: "Le pasás el link al cliente",
    text: "Lo abre, revisa el acuerdo y deposita el total al principio.",
  },
  {
    title: "Arrancás tranquila",
    text: "Cuando Pactá ve el depósito, la plata queda guardada para vos y te avisamos que ya podés empezar.",
  },
  {
    title: "Entregás por partes",
    text: "Cuando terminás un hito, subís el link de lo que hiciste y una nota.",
  },
  {
    title: "Cobrás cada hito",
    text: "Apenas el cliente aprueba, Pactá te paga ese tramo y te da un recibo.",
  },
];

/** Pasos para quien paga. */
export const clientSteps: readonly Step[] = [
  {
    title: "Abrís el link",
    text: "Ves qué se acordó: el trabajo, los hitos y cuánto cuesta cada uno.",
  },
  {
    title: "Depositás al principio",
    text: "Conectás tu billetera y depositás el total (también podés hacerlo en partes). La plata queda guardada: todavía no se la lleva nadie.",
  },
  {
    title: "Revisás cada entrega",
    text: "Te avisamos por mail cuando hay algo para revisar, con el link a la entrega.",
  },
  {
    title: "Aprobás con tu firma",
    text: "Aprobar es firmar desde tu billetera. No mueve plata por sí solo.",
  },
  {
    title: "Se paga solo ese tramo",
    text: "Cada hito se paga por separado. Lo que falta entregar sigue guardado.",
  },
];

/** Qué pasa si el cliente no responde. */
export const noReply: readonly Step[] = [
  { title: "A los 3 días", text: "Le mandamos un segundo aviso al cliente." },
  { title: "A los 6 días", text: "Si sigue sin responder, el hito se libera solo y la freelancer cobra." },
];

export type Faq = { question: string; answer: string };

export const faqs: readonly Faq[] = [
  {
    question: "¿Qué es wARS?",
    answer:
      "Es una versión digital del peso argentino, emitida por Ripio. Un wARS equivale a un peso argentino. Con wBRL y wMXN pasa lo mismo con el real y el peso mexicano.",
  },
  {
    question: "¿Qué billetera necesito?",
    answer:
      "Una billetera que funcione con la red Celo, como MiniPay, Valora o MetaMask. Si usás MiniPay, Pactá se conecta sola. La billetera es como tu cuenta: ahí se reciben y se mandan los pagos.",
  },
  {
    question: "¿Qué pasa si no apruebo una entrega?",
    answer:
      "Tenés 3 días para revisarla. Si no respondés, te mandamos un segundo aviso, y a los 6 días en total el pago de ese hito se libera solo. Si algo no te cierra, podés pausar el hito antes de que se cumpla el plazo.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Por ahora Pactá no cobra comisión. Cada movimiento en la red tiene un costo mínimo, de unos pocos centavos.",
  },
  {
    question: "¿Mi plata está segura?",
    answer:
      "El depósito queda guardado por el agente de Pactá y solo sale cuando se aprueba un hito o vence el plazo. Cada pago queda registrado con un recibo que podés comprobar. Durante la hackathon hay un tope de plata por acuerdo.",
  },
];
