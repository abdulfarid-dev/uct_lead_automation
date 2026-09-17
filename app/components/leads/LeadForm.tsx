"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
  X,
} from "lucide-react";

export interface LeadFormData {
  sector: string;
  website: string;
  location: string;
  phone: string;
  email: string;
  googleBusinessProfile: string;
}

interface LeadFormProps {
  lead?: LeadFormData & { id?: number } | null;
  loading?: boolean;
  onSubmit: (data: LeadFormData) => Promise<void> | void;
  onCancel: () => void;
}

const emptyForm: LeadFormData = {
  sector: "",
  website: "",
  location: "",
  phone: "",
  email: "",
  googleBusinessProfile: "",
};

export default function LeadForm({
  lead,
  loading = false,
  onSubmit,
  onCancel,
}: LeadFormProps) {
  const [form, setForm] =
    useState<LeadFormData>(emptyForm);

  useEffect(() => {
    if (lead) {
      setForm({
        sector: lead.sector || "",
        website: lead.website || "",
        location: lead.location || "",
        phone: lead.phone || "",
        email: lead.email || "",
        googleBusinessProfile:
          lead.googleBusinessProfile || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [lead]);

  function updateField(
    field: keyof LeadFormData,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    await onSubmit(form);
  }

  const isEdit = Boolean(lead);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/30">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {isEdit ? "Edit Lead" : "Add Lead"}
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-500">
              {isEdit
                ? "Update lead information."
                : "Add a new lead to the database."}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">

            {/* Sector */}
            <FormField
              label="Sector"
              icon={Globe}
              required
            >
              <input
                type="text"
                value={form.sector}
                onChange={(event) =>
                  updateField(
                    "sector",
                    event.target.value
                  )
                }
                placeholder="e.g. Manufacturing"
                disabled={loading}
                required
                className={inputClass}
              />
            </FormField>

            {/* Website */}
            <FormField
              label="Website"
              icon={Globe}
              required
            >
              <input
                type="text"
                value={form.website}
                onChange={(event) =>
                  updateField(
                    "website",
                    event.target.value
                  )
                }
                placeholder="example.com"
                disabled={loading}
                required
                className={inputClass}
              />
            </FormField>

            {/* Location */}
            <FormField
              label="Location"
              icon={MapPin}
            >
              <input
                type="text"
                value={form.location}
                onChange={(event) =>
                  updateField(
                    "location",
                    event.target.value
                  )
                }
                placeholder="City, State, Country"
                disabled={loading}
                className={inputClass}
              />
            </FormField>

            {/* Phone */}
            <FormField
              label="Phone"
              icon={Phone}
            >
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value
                  )
                }
                placeholder="+91..."
                disabled={loading}
                className={inputClass}
              />
            </FormField>
                        {/* Business Email */}
            <FormField
              label="Business Email"
              icon={Mail}
            >
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value
                  )
                }
                placeholder="info@example.com"
                disabled={loading}
                className={inputClass}
              />
            </FormField>

            {/* Google Business Profile */}
            <FormField
              label="Google Business Profile"
              icon={MapPin}
            >
              <input
                type="url"
                value={form.googleBusinessProfile}
                onChange={(event) =>
                  updateField(
                    "googleBusinessProfile",
                    event.target.value
                  )
                }
                placeholder="Google Business Profile URL"
                disabled={loading}
                className={inputClass}
              />
            </FormField>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/30 px-5 py-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-slate-800 px-3.5 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} />

              {loading
                ? "Saving..."
                : isEdit
                  ? "Update Lead"
                  : "Save Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  icon: Icon,
  required = false,
  children,
}: {
  label: string;
  icon: typeof Globe;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon size={12} />

        {label}

        {required && (
          <span className="text-blue-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500/60 focus:bg-slate-900 focus:ring-1 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";