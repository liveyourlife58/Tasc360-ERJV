"use client";

import { useActionState } from "react";

export function ContactForm({
  action,
}: {
  action: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(action, null as { error?: string } | null);

  return (
    <form action={formAction} className="site-contact-form">
      <div className="form-group">
        <label htmlFor="contact-form-name">Your name</label>
        <input
          id="contact-form-name"
          name="name"
          type="text"
          placeholder="Jane Doe"
          className="form-control"
          autoComplete="name"
        />
      </div>
      <div className="form-group">
        <label htmlFor="contact-form-email">Your email *</label>
        <input
          id="contact-form-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="form-control"
          autoComplete="email"
        />
      </div>
      <div className="form-group">
        <label htmlFor="contact-form-message">Message *</label>
        <textarea
          id="contact-form-message"
          name="message"
          required
          rows={5}
          placeholder="Your message..."
          className="form-control"
        />
      </div>
      {state?.error && (
        <p className="view-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Send message
      </button>
    </form>
  );
}
