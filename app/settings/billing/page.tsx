"use client";

import { Suspense } from "react";
import { BillingUpgradeHub } from "./BillingUpgradeHub";

/**
 * /settings/billing — the Billing Management & Account Plan Upgrade hub.
 *
 * Next refuses to statically render a page whose client components read the
 * URL, so `useSearchParams` has to sit under Suspense or the build fails. The
 * wrapper owns that boundary; the hub below is where the state lives.
 */
export default function BillingPage() {
  return (
    <Suspense fallback={<div className="pilot-voice text-3xl">Billing</div>}>
      <BillingUpgradeHub />
    </Suspense>
  );
}
