import "server-only";

/**
 * Online payment provider abstraction.
 *
 * No provider adapter ships yet: Iraqi gateways (ZainCash, FIB, Qi Card…)
 * each require merchant onboarding and sandbox credentials to build and
 * verify against. Until an adapter is implemented AND configured, the
 * checkout only offers cash on delivery and never shows an online option.
 */
export interface PaymentProvider {
  id: string;
  /** Create a payment session and return the URL to redirect the customer to. */
  createPayment(input: { orderId: string; orderNumber: string; amount: number; locale: "ar" | "en" }): Promise<{ redirectUrl: string; reference: string }>;
  /** Verify a provider callback; return the order id and whether it was paid. */
  verifyCallback(params: URLSearchParams): Promise<{ orderId: string; paid: boolean; reference: string }>;
}

const providers: Record<string, PaymentProvider> = {};

export function getPaymentProvider(): PaymentProvider | null {
  const id = process.env.PAYMENT_PROVIDER;
  if (!id || !process.env.PAYMENT_PROVIDER_SECRET) return null;
  return providers[id] ?? null;
}

export function onlinePaymentAvailable(): boolean {
  return getPaymentProvider() !== null;
}
