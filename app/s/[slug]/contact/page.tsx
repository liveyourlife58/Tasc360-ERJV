import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTenantBySlug } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { submitContactForm } from "@/app/s/actions";
import { ContactForm } from "@/components/site/ContactForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { title: "Not found" };
  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}/contact`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  return {
    title: "Contact",
    description: `Contact ${meta.siteName}. Get in touch.`,
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function SiteContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  const rawContact = pages.contact;
  const isLegacyString = typeof rawContact === "string";
  const legacyContent = isLegacyString ? (rawContact as string) : undefined;
  const contact =
    typeof rawContact === "object" && rawContact !== null && !Array.isArray(rawContact)
      ? (rawContact as Record<string, unknown>)
      : undefined;
  const email = contact?.email as string | undefined;
  const phone = contact?.phone as string | undefined;
  const addressLine1 = contact?.addressLine1 as string | undefined;
  const addressLine2 = contact?.addressLine2 as string | undefined;
  const city = contact?.city as string | undefined;
  const state = contact?.state as string | undefined;
  const postalCode = contact?.postalCode as string | undefined;
  const country = contact?.country as string | undefined;
  const extraContent = contact?.extraContent as string | undefined;
  const hasStructured =
    email || phone || addressLine1 || addressLine2 || city || state || postalCode || country;
  const hasMethods = !!(email || phone);
  const hasAddress = !!(addressLine1 || addressLine2 || city || state || postalCode || country);
  const hasExtra = (extraContent ?? "").trim() !== "";
  const hasLegacy = (legacyContent ?? "").trim() !== "";

  return (
    <div className="site-page">
      <h1>Contact</h1>
      {isLegacyString && hasLegacy ? (
        <div className="site-prose" dangerouslySetInnerHTML={{ __html: legacyContent! }} />
      ) : (
        <>
          {hasStructured && (
            <div className="site-contact">
              <div className={`site-contact-grid${hasMethods && hasAddress ? "" : " site-contact-grid--single"}`}>
                {(email || phone) && (
                  <div className="site-contact-block site-contact-methods">
                    <h2 className="site-contact-block-title">Get in touch</h2>
                    {email && (
                      <div className="site-contact-row">
                        <span className="site-contact-label">Email</span>
                        <a href={`mailto:${email}`} className="site-contact-link">{email}</a>
                      </div>
                    )}
                    {phone && (
                      <div className="site-contact-row">
                        <span className="site-contact-label">Phone</span>
                        <a href={`tel:${phone.replace(/\s/g, "")}`} className="site-contact-link">{phone}</a>
                      </div>
                    )}
                  </div>
                )}
                {(addressLine1 || addressLine2 || city || state || postalCode || country) && (
                  <div className="site-contact-block site-contact-address-block">
                    <h2 className="site-contact-block-title">Visit us</h2>
                    <address className="site-contact-address">
                      {addressLine1 && <span className="site-contact-address-line">{addressLine1}</span>}
                      {addressLine2 && <span className="site-contact-address-line">{addressLine2}</span>}
                      {(city || state || postalCode) && (
                        <span className="site-contact-address-line">
                          {[city, state, postalCode].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {country && <span className="site-contact-address-line">{country}</span>}
                    </address>
                  </div>
                )}
              </div>
            </div>
          )}
          {hasExtra && (
            <div className="site-contact-extra site-prose" dangerouslySetInnerHTML={{ __html: extraContent! }} />
          )}
          {!hasStructured && !hasExtra && !hasLegacy && (
            <p>Get in touch. Add contact details from your dashboard settings.</p>
          )}
          {email && (
            <section className="site-contact-form-section" aria-labelledby="contact-form-heading">
              <h2 id="contact-form-heading" className="site-contact-form-heading">Send a message</h2>
              <ContactForm action={submitContactForm.bind(null, slug)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
