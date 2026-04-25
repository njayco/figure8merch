import { getUncachableResendClient } from "./resendClient";
import { logger } from "./logger";

interface OrderForEmail {
  id: number;
  total: number | string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  estimatedDeliveryAt: Date | null;
  shippingAddress: string;
  items: Array<{
    productName: string;
    quantity: number;
    size: string;
    price: number;
  }>;
}

interface CustomerForEmail {
  email: string;
  name: string;
}

const BRAND_NAME = "Figure 8";

function formatDate(d: Date | null): string {
  if (!d) return "soon";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function trackingUrl(carrier: string | null, tracking: string | null): string | null {
  if (!tracking) return null;
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${encodeURIComponent(tracking)}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tracking)}`;
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tracking)}`;
  if (c.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(tracking)}`;
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemsList(order: OrderForEmail): string {
  return order.items
    .map(
      (i) =>
        `<li style="margin:4px 0;">${escapeHtml(i.productName)} — size ${escapeHtml(i.size)} × ${i.quantity}</li>`,
    )
    .join("");
}

function shellHtml(title: string, body: string): string {
  return `<!doctype html>
<html><body style="font-family:Helvetica,Arial,sans-serif;background:#faf7f2;color:#2b1f15;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:12px;padding:32px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;letter-spacing:2px;color:#5a3b22;margin:0 0 8px;">${BRAND_NAME}</h1>
    <h2 style="font-size:18px;color:#3a2a1a;margin:16px 0 12px;">${title}</h2>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#8a7a68;">${BRAND_NAME} · Thank you for shopping with us.</p>
  </div>
</body></html>`;
}

function buildShippedEmail(order: OrderForEmail, customer: CustomerForEmail) {
  const url = trackingUrl(order.carrier, order.trackingNumber);
  const trackingBlock = order.trackingNumber
    ? `<p style="margin:8px 0;"><strong>Carrier:</strong> ${escapeHtml(order.carrier ?? "—")}<br/>
       <strong>Tracking #:</strong> ${escapeHtml(order.trackingNumber)}${
         url
           ? `<br/><a href="${url}" style="color:#5a3b22;">Track your package →</a>`
           : ""
       }</p>`
    : "";

  const html = shellHtml(
    `Your order is on its way`,
    `<p>Hi ${escapeHtml(customer.name)},</p>
     <p>Good news — order <strong>#${order.id}</strong> has shipped. Estimated delivery: <strong>${formatDate(order.estimatedDeliveryAt)}</strong>.</p>
     ${trackingBlock}
     <p style="margin-top:16px;"><strong>Shipping to:</strong><br/>${escapeHtml(order.shippingAddress).replace(/\n/g, "<br/>")}</p>
     <p style="margin-top:16px;"><strong>What's in the box:</strong></p>
     <ul style="padding-left:18px;">${itemsList(order)}</ul>`,
  );

  const textLines = [
    `Hi ${customer.name},`,
    ``,
    `Order #${order.id} has shipped. Estimated delivery: ${formatDate(order.estimatedDeliveryAt)}.`,
  ];
  if (order.trackingNumber) {
    textLines.push(``, `Carrier: ${order.carrier ?? "—"}`, `Tracking #: ${order.trackingNumber}`);
    if (url) textLines.push(`Track: ${url}`);
  }
  textLines.push(``, `Shipping to:`, order.shippingAddress);
  textLines.push(``, `Items:`);
  for (const i of order.items) textLines.push(`- ${i.productName} (size ${i.size}) × ${i.quantity}`);
  textLines.push(``, `— ${BRAND_NAME}`);

  return {
    subject: `Your ${BRAND_NAME} order #${order.id} has shipped`,
    html,
    text: textLines.join("\n"),
  };
}

function buildDeliveredEmail(order: OrderForEmail, customer: CustomerForEmail) {
  const html = shellHtml(
    `Your order has arrived`,
    `<p>Hi ${escapeHtml(customer.name)},</p>
     <p>Order <strong>#${order.id}</strong> was just marked delivered. We hope you love it.</p>
     <p style="margin-top:16px;"><strong>Delivered to:</strong><br/>${escapeHtml(order.shippingAddress).replace(/\n/g, "<br/>")}</p>
     <p style="margin-top:16px;"><strong>What you received:</strong></p>
     <ul style="padding-left:18px;">${itemsList(order)}</ul>
     <p style="margin-top:16px;">If anything looks off, just reply to this email and we'll make it right.</p>`,
  );

  const textLines = [
    `Hi ${customer.name},`,
    ``,
    `Order #${order.id} was just marked delivered. We hope you love it.`,
    ``,
    `Delivered to:`,
    order.shippingAddress,
    ``,
    `Items:`,
  ];
  for (const i of order.items) textLines.push(`- ${i.productName} (size ${i.size}) × ${i.quantity}`);
  textLines.push(``, `If anything looks off, just reply and we'll make it right.`, ``, `— ${BRAND_NAME}`);

  return {
    subject: `Your ${BRAND_NAME} order #${order.id} has arrived`,
    html,
    text: textLines.join("\n"),
  };
}

async function send(
  kind: "shipped" | "delivered",
  order: OrderForEmail,
  customer: CustomerForEmail,
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const built = kind === "shipped" ? buildShippedEmail(order, customer) : buildDeliveredEmail(order, customer);
    const result = await client.emails.send({
      from: `${BRAND_NAME} <${fromEmail}>`,
      to: customer.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
    if (result.error) {
      logger.error(
        { kind, orderId: order.id, error: result.error },
        "[order-email] send failed",
      );
      return false;
    }
    logger.info(
      { kind, orderId: order.id, to: customer.email },
      "[order-email] sent",
    );
    return true;
  } catch (err) {
    logger.error(
      { kind, orderId: order.id, err },
      "[order-email] send threw",
    );
    return false;
  }
}

export function sendShippedEmail(order: OrderForEmail, customer: CustomerForEmail): Promise<boolean> {
  return send("shipped", order, customer);
}

export function sendDeliveredEmail(order: OrderForEmail, customer: CustomerForEmail): Promise<boolean> {
  return send("delivered", order, customer);
}
