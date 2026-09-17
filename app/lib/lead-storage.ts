import prisma from "./prisma";

import { ResearchLead } from "@/app/types/research";

function normalizeWebsite(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();

  return email || null;
}

function normalizePhone(value: string): string | null {
  const phone = value.replace(/\D/g, "");

  return phone || null;
}

export interface SaveLeadsResult {
  saved: number;
  duplicates: number;
}

export async function getLeads(): Promise<ResearchLead[]> {
  const leads = await prisma.lead.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return leads.map((lead) => ({
    sector: lead.sector,
    website: lead.website,
    location: lead.location ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    googleBusinessProfile: lead.googleBusinessProfile ?? "",
  }));
}

export async function saveLeads(
  leads: ResearchLead[]
): Promise<SaveLeadsResult> {
  const data = leads
    .map((lead) => ({
      sector: lead.sector.trim(),
      website: normalizeWebsite(lead.website),
      location: lead.location?.trim() || null,
      phone: normalizePhone(lead.phone),
      email: normalizeEmail(lead.email),
      googleBusinessProfile:
        lead.googleBusinessProfile?.trim() || null,
    }))
    .filter((lead) => lead.website);

  if (!data.length) {
    return {
      saved: 0,
      duplicates: leads.length,
    };
  }

  /*
   * Remove duplicates inside the current research batch.
   * A lead is considered duplicate if ANY unique field matches:
   * website OR phone OR email.
   */
  const batchWebsites = new Set<string>();
  const batchPhones = new Set<string>();
  const batchEmails = new Set<string>();

  const uniqueBatch = data.filter((lead) => {
    const websiteDuplicate = batchWebsites.has(lead.website);

    const phoneDuplicate =
      lead.phone !== null && batchPhones.has(lead.phone);

    const emailDuplicate =
      lead.email !== null && batchEmails.has(lead.email);

    if (websiteDuplicate || phoneDuplicate || emailDuplicate) {
      return false;
    }

    batchWebsites.add(lead.website);

    if (lead.phone !== null) {
      batchPhones.add(lead.phone);
    }

    if (lead.email !== null) {
      batchEmails.add(lead.email);
    }

    return true;
  });

  const duplicatesInsideBatch =
    data.length - uniqueBatch.length;

  if (!uniqueBatch.length) {
    return {
      saved: 0,
      duplicates: leads.length,
    };
  }

  /*
   * Check PostgreSQL before inserting.
   * Existing records are ONLY read here; nothing is updated or overwritten.
   */
  const existing = await prisma.lead.findMany({
    where: {
      OR: [
        ...uniqueBatch.map((lead) => ({
          website: lead.website,
        })),

        ...uniqueBatch
          .filter((lead) => lead.phone !== null)
          .map((lead) => ({
            phone: lead.phone as string,
          })),

        ...uniqueBatch
          .filter((lead) => lead.email !== null)
          .map((lead) => ({
            email: lead.email as string,
          })),
      ],
    },

    select: {
      website: true,
      phone: true,
      email: true,
    },
  });

  const existingWebsites = new Set<string>(
    existing.map((lead) => normalizeWebsite(lead.website))
  );

  const existingPhones = new Set<string>();

  for (const lead of existing) {
    if (lead.phone !== null) {
      const phone = normalizePhone(lead.phone);

      if (phone !== null) {
        existingPhones.add(phone);
      }
    }
  }

  const existingEmails = new Set<string>();

  for (const lead of existing) {
    if (lead.email !== null) {
      const email = normalizeEmail(lead.email);

      if (email !== null) {
        existingEmails.add(email);
      }
    }
  }

  const newLeads = uniqueBatch.filter((lead) => {
    const websiteDuplicate = existingWebsites.has(lead.website);

    const phoneDuplicate =
      lead.phone !== null && existingPhones.has(lead.phone);

    const emailDuplicate =
      lead.email !== null && existingEmails.has(lead.email);

    return !websiteDuplicate && !phoneDuplicate && !emailDuplicate;
  });

  const duplicatesAgainstDatabase =
    uniqueBatch.length - newLeads.length;

  if (!newLeads.length) {
    return {
      saved: 0,
      duplicates:
        duplicatesInsideBatch + duplicatesAgainstDatabase,
    };
  }

  /*
   * Database UNIQUE constraints remain the final protection against
   * duplicate inserts. Existing rows are never updated.
   */
  await prisma.lead.createMany({
    data: newLeads,
    skipDuplicates: true,
  });

  return {
    saved: newLeads.length,
    duplicates:
      duplicatesInsideBatch + duplicatesAgainstDatabase,
  };
}

export async function addLeads(
  newLeads: ResearchLead[]
): Promise<SaveLeadsResult> {
  return saveLeads(newLeads);
}