"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  sender?: { name?: string; email?: string } | null;
  modifiedAt?: string | null;
};

type Props = {
  open: boolean;
  template: EmailTemplate | null;
  onClose: () => void;
};

export default function EmailTemplateModal({
  open,
  template,
  onClose,
}: Props) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !template) {
      setDetails(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/email-outreach/templates?id=${template.id}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!cancelled && response.ok && data.success) {
          setDetails(data.template);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, template]);

  if (!open || !template) return null;

  const html = details?.htmlContent || details?.textContent || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">
              {template.name}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-600">
              Brevo template #{template.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-600">
              Loading template...
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Subject
                </span>
                <p className="mt-1 rounded-md border border-slate-800 bg-slate-900/45 px-3 py-2 text-xs text-slate-200">
                  {details?.subject || template.subject || "—"}
                </p>
              </div>

              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Content
                </span>
                <div className="mt-1 rounded-md border border-slate-800 bg-slate-900/45 p-3">
                  {html ? (
                    <iframe
                      title="Brevo template preview"
                      srcDoc={html}
                      sandbox=""
                      className="h-[430px] w-full rounded bg-white"
                    />
                  ) : (
                    <p className="text-xs text-slate-600">
                      No preview content returned by Brevo.
                    </p>
                  )}
                </div>
              </div>

              <a
                href="https://app.brevo.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300"
              >
                Manage this template in Brevo
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
