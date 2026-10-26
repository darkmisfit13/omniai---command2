import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy — OmniAI",
  description: "OmniAI offers a 30-day money-back guarantee, and refunds every failed generation.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        We offer a 30-day money-back guarantee. If you are not satisfied with a plan subscription,
        you can request a full refund within 30 days of your order date.
      </p>

      <h2>Failed generations are refunded automatically</h2>
      <p>
        Credits are reserved before a generation starts and returned the moment it cannot produce a
        result — whether that is a provider running out of quota, a key that does not work, or any
        other failure on our side. You are never charged credits for output you did not receive,
        and this happens without you having to ask.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Contact us with the email on your account and the purchase date, and we will process your
        refund. Refunds are returned to your original payment method through our payment processor,
        Stripe, and usually appear within 5–10 business days.
      </p>

      <h2>Cancelling a subscription</h2>
      <p>
        You can cancel any time. You keep access until the end of the period you already paid for,
        and any credits you have already banked stay on your account.
      </p>
    </LegalPage>
  );
}
