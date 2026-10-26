import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, SELLER } from "@/app/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — OmniAI",
  description: "The terms that apply when you use OmniAI by DarkMisfitStudios.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        OmniAI (the &ldquo;Service&rdquo;) is provided by {SELLER} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). When you use the Service you are contracting with Benjamin Cody James
        (DarkMisfitStudios). By creating an account or continuing to use the Service, you agree to
        these terms.
      </p>

      <h2>The Service</h2>
      <p>
        OmniAI is an AI workspace for chat, images, video, music, voice, websites and video editing.
        Features are metered with credits and optional paid plans. You must be of legal age to form
        a contract, or have authority to bind the organisation you use it for.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your login details confidential; you are responsible for activity under your account.
        Provide accurate information and keep it up to date.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>No unlawful use, fraud, spam or harassment.</li>
        <li>No infringing others&rsquo; intellectual property or privacy.</li>
        <li>
          No malware, probing, scraping, or interfering with the Service&rsquo;s security or limits.
        </li>
        <li>No reverse engineering, reselling, or redistributing the Service.</li>
        <li>
          No generating illegal content, deceptive deepfakes of real people, hate speech, or attempts
          to bypass safety filters.
        </li>
      </ul>

      <h2>AI inputs and outputs</h2>
      <p>
        You are responsible for your prompts and uploads, for having the rights to them, and for how
        you use the results. AI output can be inaccurate or incomplete — verify it before relying on
        it, and do not use it as a substitute for professional (legal, medical, financial) advice.
        Subject to these terms, you may use outputs you create. You grant us a limited licence to
        host and process your content solely to provide the Service. We may remove content, refuse
        or filter outputs, and suspend accounts that break these rules. Rights-holders can report
        infringing content to us; repeated infringement leads to termination.
      </p>

      <h2>Credits</h2>
      <p>
        Every action on the Service costs a published number of credits, listed in full on the{" "}
        <Link href="/pricing">Pricing page</Link>. Credits are granted with your plan each billing
        period and do not roll over unless stated at purchase. If a generation fails, the credits
        reserved for it are returned to your balance automatically — you are only ever charged for
        output that was actually produced.
      </p>

      <h2>Ownership</h2>
      <p>
        We retain all rights in the Service, including its software, documentation and branding. We
        grant you a limited, non-exclusive, non-transferable right to use it within your plan.
      </p>

      <h2>Payments and subscriptions</h2>
      <p>
        Payments are processed securely by our payment processor, Stripe. Applicable sales tax or
        VAT is calculated and collected at checkout. Subscriptions renew automatically at the end of
        each billing period until cancelled, and you can cancel any time from the Pricing page. Your
        card details are handled by Stripe and are never stored by us. See also our{" "}
        <Link href="/refund-policy">Refund Policy</Link>.
      </p>

      <h2>Service level</h2>
      <p>
        We work to keep the Service reliable but do not guarantee it will be uninterrupted or
        error-free. Generation depends on third-party AI providers whose availability we do not
        control; when a provider cannot fulfil a request, the credits reserved for it are returned
        to you. To the fullest extent permitted by law, the Service is provided &ldquo;as is&rdquo;
        without implied warranties of merchantability or fitness for a particular purpose.
      </p>

      <h2>Liability</h2>
      <p>
        Our total liability is limited to the fees you paid in the 12 months before the claim. We
        are not liable for indirect or consequential losses (such as lost profits or data). Nothing
        limits liability for fraud, death or personal injury where the law does not allow it.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        We may suspend or end access for material breach, non-payment, security or fraud risk, or
        repeated or serious violations. When access ends you may request an export of your data
        within 30 days, after which it may be deleted.
      </p>

      <h2>General</h2>
      <p>
        These terms are governed by the laws of the seller&rsquo;s home jurisdiction in the United
        States. You may not assign these terms without our consent. We are not responsible for delays
        caused by events beyond our reasonable control. We may update these terms and will post
        changes here.
      </p>
    </LegalPage>
  );
}
