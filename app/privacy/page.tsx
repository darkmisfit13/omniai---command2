import type { Metadata } from "next";
import { LegalPage, SELLER } from "@/app/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Notice — OmniAI",
  description: "How DarkMisfitStudios collects, uses and protects your data in OmniAI.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice">
      <p>
        OmniAI is operated by {SELLER}, who is the data controller responsible for your personal
        data.
      </p>

      <h2>Data we collect and why</h2>
      <ul>
        <li>
          <strong>Account data</strong> (name, email, login credentials) — to create and secure your
          account (contract).
        </li>
        <li>
          <strong>Content you create</strong> (prompts, uploads, generated files, projects) — to
          provide the Service (contract).
        </li>
        <li>
          <strong>Usage and credit records</strong> — to run the credit wallet, prevent abuse and
          improve the product (contract, legitimate interests).
        </li>
        <li>
          <strong>Device and technical data</strong> (IP address, browser, device identifiers) — for
          security and fraud prevention (legitimate interests).
        </li>
        <li>
          <strong>Support messages</strong> — to answer your questions (legitimate interests).
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          Service providers that host the app and database and run the AI models used to fulfil your
          requests.
        </li>
        <li>
          Stripe, our payment processor, for payments, subscription management, fraud prevention,
          tax calculation and invoicing. Your card details are handled by Stripe and are never
          stored by us.
        </li>
        <li>Professional advisers (legal, accounting) where needed.</li>
        <li>Authorities where required by law.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>How your work is isolated</h2>
      <p>
        Your conversations, media, projects and billing history are scoped to your own account at
        the database level, not merely hidden in the interface. Provider credentials used to fulfil
        your requests belong to the platform and are never exposed to any account, including yours.
      </p>

      <h2>Retention</h2>
      <p>
        We keep data while your account is active and as needed for legal and accounting
        obligations, then delete or anonymise it. You can request an export of your data within 30
        days of closing your account.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may access, correct, delete or export your data, object to
        or restrict processing, and withdraw consent. Contact us to exercise these rights; you may
        also complain to your local data protection authority. Some providers may process data
        outside your country under appropriate safeguards.
      </p>

      <h2>Security</h2>
      <p>
        We use appropriate technical and organisational measures, including access controls and
        per-account data isolation, to protect your data.
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential browser storage only to keep you signed in and remember preferences. We do
        not use advertising cookies.
      </p>
    </LegalPage>
  );
}
