import Link from "next/link";
import { getTrialDays } from "@/lib/app-config";
import { getBillingConfig } from "@/lib/billing";

export function MarketingPage() {
  const trialDays = getTrialDays();
  const hasTrial = trialDays > 0;
  const { perUserFeeUsd } = getBillingConfig();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-slate-200/50 to-slate-100">
      <header className="border-b border-black/5 bg-white/85 backdrop-blur-sm">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-semibold text-teal-600">Tasc360</span>
          <nav className="flex items-center gap-4" aria-label="Main">
            <Link
              href="/login"
              className="text-[15px] text-slate-600 px-2 py-1.5 rounded hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-[15px] font-medium text-teal-600 px-4 py-2 rounded-lg hover:bg-teal-600/10 transition-colors"
            >
              Create workspace
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-[1100px] w-full mx-auto px-6 py-12 md:py-16 pb-16">
        <section className="text-center mb-10" aria-labelledby="hero-heading">
          <h1 id="hero-heading" className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Your entry into custom development—start simple, go custom when you grow
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-10">
            One place for contacts, jobs, invoices, and your customer site. No coding to start. When you need more, full-stack developers can build custom features on top—everything you put in stays here.
          </p>

          <div className="bg-white border border-slate-200 rounded-xl p-6 text-left" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading" className="text-lg font-semibold text-slate-900 mb-2">Simple pricing</h2>
            {hasTrial && (
              <p className="text-[15px] text-teal-600 font-medium mb-1">
                {trialDays}-day free trial, then:
              </p>
            )}
            <p className="text-2xl text-slate-900 mb-1">
              <strong className="text-teal-600">${perUserFeeUsd}</strong> per user per month
            </p>
            <p className="text-[15px] text-slate-500 mb-3">
              One workspace, one bill.
              {hasTrial && (
                <> Add a payment method to start—you won&apos;t be charged for {trialDays} days. Cancel anytime.</>
              )}
              {!hasTrial && " Add users as your team grows."}
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors"
            >
              {hasTrial ? `Start your ${trialDays}-day free trial` : "Start now"}
            </Link>
          </div>
        </section>

        <section className="mb-10 bg-white border border-slate-200 rounded-xl p-6" aria-labelledby="developers-heading">
          <h2 id="developers-heading" className="text-xl font-semibold text-slate-900 mb-3">Access to full-stack web developers for custom features</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            When the dashboard isn&apos;t enough—custom reports, special workflows, connections to other tools, or a branded experience—you don&apos;t have to switch platforms. We connect you with full-stack web developers who build on top of your existing workspace. Your contacts, jobs, and invoices stay in one place; they add the features you need.
          </p>
          <ul className="space-y-2 text-slate-700 text-[15px]">
            <li className="flex gap-2">
              <span className="text-teal-600 shrink-0" aria-hidden>✓</span>
              <span><strong>Custom pages and flows</strong> — Tailored forms, dashboards, or customer-facing experiences that match your process.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600 shrink-0" aria-hidden>✓</span>
              <span><strong>Integrations</strong> — Connect to accounting, CRM, scheduling, or other tools you already use.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600 shrink-0" aria-hidden>✓</span>
              <span><strong>Automation and workflows</strong> — Notifications, approvals, or steps that run automatically so you spend less time on repeat work.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600 shrink-0" aria-hidden>✓</span>
              <span><strong>No migration</strong> — Everything you&apos;ve already added stays where it is. Developers extend what you have; you don&apos;t start over.</span>
            </li>
          </ul>
        </section>

        <section className="text-center" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="sr-only">Summary</h2>
          <p className="text-slate-600 leading-relaxed">
            For small teams, field service, professional services, nonprofits, and agencies. Set up your way—invite people, pay per seat, and grow without starting over.
          </p>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white/60 py-5 px-6">
        <div className="max-w-[1100px] mx-auto text-sm text-slate-500 text-center">
          <Link href="/login" className="text-slate-600 hover:text-teal-600">Sign in</Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link href="/signup" className="text-slate-600 hover:text-teal-600">Create workspace</Link>
          <span className="mx-2 text-slate-300">·</span>
          <span className="text-slate-400">Tasc360</span>
        </div>
      </footer>
    </div>
  );
}
