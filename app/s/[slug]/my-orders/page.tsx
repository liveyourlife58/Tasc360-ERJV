import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function MyOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { slug } = await params;
  const { email: emailParam } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const siteName = (site.name as string) ?? tenant.name;

  const email = (emailParam ?? "").trim().toLowerCase();
  const orders =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? await prisma.order.findMany({
          where: {
            tenantId: tenant.id,
            purchaserEmail: email,
            status: "completed",
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            orderLines: {
              include: {
                entity: { select: { id: true, data: true } },
              },
            },
          },
        })
      : [];

  return (
    <div className="site-page site-my-orders">
      <h1>My orders</h1>
      <p className="site-my-orders-intro">
        Enter the email address you used when placing your order to view your order history.
      </p>
      <form method="get" action={`/s/${slug}/my-orders`} className="site-my-orders-form">
        <label htmlFor="my-orders-email">Email</label>
        <input
          id="my-orders-email"
          type="email"
          name="email"
          defaultValue={email}
          placeholder="you@example.com"
          required
          className="form-control"
          autoComplete="email"
        />
        <button type="submit" className="btn btn-primary">
          View orders
        </button>
      </form>

      {email && (
        <>
          {orders.length === 0 ? (
            <p className="site-my-orders-empty">No orders found for this email.</p>
          ) : (
            <ul className="site-my-orders-list">
              {orders.map((order) => (
                <li key={order.id} className="site-my-orders-item">
                  <div className="site-my-orders-item-header">
                    <span className="site-my-orders-date">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="site-my-orders-total">
                      ${(order.totalCents / 100).toFixed(2)} total
                    </span>
                  </div>
                  <ul className="site-my-orders-lines">
                    {order.orderLines.map((line) => {
                      const title =
                        (line.entity?.data as Record<string, unknown>)?.title ??
                        (line.entity?.data as Record<string, unknown>)?.name ??
                        "Item";
                      return (
                        <li key={line.id}>
                          {String(title).slice(0, 80)}
                          {line.quantity > 1 ? ` × ${line.quantity}` : ""} — $
                          {((line.amountCents * line.quantity) / 100).toFixed(2)}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p style={{ marginTop: "1.5rem" }}>
        <Link href={`/s/${slug}`} className="btn btn-secondary">
          Back to {siteName}
        </Link>
      </p>
    </div>
  );
}
