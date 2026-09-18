import EmailOutreachPage from "@/app/components/email-outreach/EmailOutreachPage";

export default function Page() {
  return <EmailOutreachPage />;
}
// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   CheckCircle2,
//   ChevronDown,
//   Clock3,
//   Mail,
//   Plus,
//   RefreshCw,
//   Search,
//   Send,
//   X,
// } from "lucide-react";

// type EmailStatus =
//   | "pending"
//   | "scheduled"
//   | "sending"
//   | "sent"
//   | "failed";

// type OutreachTab =
//   | "pending"
//   | "scheduled"
//   | "sent"
//   | "failed";

// interface Lead {
//   id: number;
//   sector: string;
//   website: string;
//   location: string;
//   phone: string;
//   email: string;
//   googleBusinessProfile: string;
//   verificationStatus:
//     | "under_review"
//     | "verified"
//     | "rejected";
//   emailStatus: EmailStatus;
//   emailScheduledAt: string | null;
//   emailSentAt: string | null;
//   emailError: string | null;
// }

// interface ApiResponse {
//   success?: boolean;
//   leads?: unknown[];
//   lead?: unknown;
//   error?: string;
//   message?: string;
// }

// interface EmailTemplate {
//   id: string;
//   name: string;
//   subject: string;
//   body: string;
// }

// interface Sender {
//   id: string;
//   name: string;
//   email: string;
// }

// const DEFAULT_TEMPLATES: EmailTemplate[] = [
//   {
//     id: "default-pitch",
//     name: "UCT Industrial IoT Pitch",
//     subject: "Industrial IoT Solutions for {{company_name}}",
//     body: `Hello {{company_name}},

// We came across your business and noticed your operations in the {{sector}} sector.

// We would like to introduce UniConverge Technologies and our Industrial IoT solutions for monitoring, connectivity, automation and operational visibility.

// Website: {{website}}

// If this is relevant to your current operations, we would be happy to discuss how UCT can support your requirements.

// Regards,
// UCT Team`,
//   },
// ];

// const DEFAULT_SENDERS: Sender[] = [
//   {
//     id: "uct-primary",
//     name: "UCT",
//     email: "sales@uniconvergetech.in",
//   },
// ];

// const TABS: {
//   key: OutreachTab;
//   label: string;
// }[] = [
//   {
//     key: "pending",
//     label: "Ready to Send",
//   },
//   {
//     key: "scheduled",
//     label: "Scheduled",
//   },
//   {
//     key: "sent",
//     label: "Sent",
//   },
//   {
//     key: "failed",
//     label: "Failed",
//   },
// ];

// function normalizeLead(value: unknown): Lead {
//   const lead =
//     value && typeof value === "object"
//       ? (value as Record<string, unknown>)
//       : {};

//   const verificationStatus =
//     lead.verificationStatus === "verified" ||
//     lead.verificationStatus === "rejected"
//       ? lead.verificationStatus
//       : "under_review";

//   const emailStatus =
//     lead.emailStatus === "scheduled" ||
//     lead.emailStatus === "sending" ||
//     lead.emailStatus === "sent" ||
//     lead.emailStatus === "failed"
//       ? lead.emailStatus
//       : "pending";

//   return {
//     id:
//       typeof lead.id === "number"
//         ? lead.id
//         : Number(lead.id) || 0,

//     sector:
//       typeof lead.sector === "string"
//         ? lead.sector
//         : "",

//     website:
//       typeof lead.website === "string"
//         ? lead.website
//         : "",

//     location:
//       typeof lead.location === "string"
//         ? lead.location
//         : "",

//     phone:
//       typeof lead.phone === "string"
//         ? lead.phone
//         : "",

//     email:
//       typeof lead.email === "string"
//         ? lead.email
//         : "",

//     googleBusinessProfile:
//       typeof lead.googleBusinessProfile === "string"
//         ? lead.googleBusinessProfile
//         : "",

//     verificationStatus,

//     emailStatus,

//     emailScheduledAt:
//       typeof lead.emailScheduledAt === "string"
//         ? lead.emailScheduledAt
//         : null,

//     emailSentAt:
//       typeof lead.emailSentAt === "string"
//         ? lead.emailSentAt
//         : null,

//     emailError:
//       typeof lead.emailError === "string"
//         ? lead.emailError
//         : null,
//   };
// }

// async function readApiResponse(
//   response: Response
// ): Promise<ApiResponse> {
//   const text = await response.text();

//   if (!text.trim()) {
//     return {};
//   }

//   try {
//     return JSON.parse(text) as ApiResponse;
//   } catch {
//     return {
//       error: `Server returned an invalid response (${response.status}).`,
//     };
//   }
// }

// function normalizeSearchValue(value: string) {
//   return value
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, " ");
// }

// function formatDateTime(value: string | null) {
//   if (!value) {
//     return "—";
//   }

//   const date = new Date(value);

//   if (Number.isNaN(date.getTime())) {
//     return "—";
//   }

//   return date.toLocaleString("en-IN", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   });
// }

// export default function EmailOutreachPage() {
//   const [activeTab, setActiveTab] =
//     useState<OutreachTab>("pending");

//   const [leads, setLeads] = useState<Lead[]>([]);

//   const [loading, setLoading] = useState(true);

//   const [refreshing, setRefreshing] =
//     useState(false);

//   const [searchQuery, setSearchQuery] =
//     useState("");

//   const [selectedLeads, setSelectedLeads] =
//     useState<number[]>([]);

//   const [templates, setTemplates] =
//     useState<EmailTemplate[]>(DEFAULT_TEMPLATES);

//   const [selectedTemplateId, setSelectedTemplateId] =
//     useState(DEFAULT_TEMPLATES[0]?.id || "");

//   const [senders] =
//     useState<Sender[]>(DEFAULT_SENDERS);

//   const [selectedSenderId, setSelectedSenderId] =
//     useState(DEFAULT_SENDERS[0]?.id || "");

//   const [scheduleDate, setScheduleDate] =
//     useState("");

//   const [scheduleTime, setScheduleTime] =
//     useState("");

//   const [scheduling, setScheduling] =
//     useState(false);

//   const [showTemplateForm, setShowTemplateForm] =
//     useState(false);

//   const [templateName, setTemplateName] =
//     useState("");

//   const [templateSubject, setTemplateSubject] =
//     useState("");

//   const [templateBody, setTemplateBody] =
//     useState("");

//   const [message, setMessage] =
//     useState("");

//   const [messageType, setMessageType] =
//     useState<"success" | "error" | "info">(
//       "info"
//     );

//   const selectedTemplate = useMemo(
//     () =>
//       templates.find(
//         (template) =>
//           template.id === selectedTemplateId
//       ) || null,
//     [templates, selectedTemplateId]
//   );

//   const selectedSender = useMemo(
//     () =>
//       senders.find(
//         (sender) =>
//           sender.id === selectedSenderId
//       ) || null,
//     [senders, selectedSenderId]
//   );

//   const fetchLeads = useCallback(
//     async (
//       status: OutreachTab,
//       showLoader = true
//     ) => {
//       try {
//         if (showLoader) {
//           setLoading(true);
//         } else {
//           setRefreshing(true);
//         }

//         setMessage("");

//         const response = await fetch(
//           `/api/leads/verified-email?status=${status}`,
//           {
//             method: "GET",
//             cache: "no-store",
//           }
//         );

//         const data =
//           await readApiResponse(response);

//         if (!response.ok) {
//           throw new Error(
//             data.error ||
//               "Failed to fetch email leads."
//           );
//         }

//         const nextLeads = Array.isArray(data.leads)
//           ? data.leads.map(normalizeLead)
//           : [];

//         setLeads(nextLeads);

//         setSelectedLeads((current) =>
//           current.filter((id) =>
//             nextLeads.some(
//               (lead) => lead.id === id
//             )
//           )
//         );
//       } catch (error) {
//         setMessageType("error");

//         setMessage(
//           error instanceof Error
//             ? error.message
//             : "Failed to fetch email leads."
//         );
//       } finally {
//         if (showLoader) {
//           setLoading(false);
//         }

//         setRefreshing(false);
//       }
//     },
//     []
//   );

//   useEffect(() => {
//     void fetchLeads(activeTab);
//   }, [activeTab, fetchLeads]);

//   const filteredLeads = useMemo(() => {
//     const query =
//       normalizeSearchValue(searchQuery);

//     if (!query) {
//       return leads;
//     }

//     return leads.filter((lead) => {
//       const searchableText = [
//         lead.sector,
//         lead.website,
//         lead.email,
//         lead.phone,
//         lead.location,
//       ]
//         .join(" ")
//         .toLowerCase();

//       return searchableText.includes(query);
//     });
//   }, [leads, searchQuery]);

//   const allVisibleSelected =
//     filteredLeads.length > 0 &&
//     filteredLeads.every((lead) =>
//       selectedLeads.includes(lead.id)
//     );

//   function showMessage(
//     text: string,
//     type: "success" | "error" | "info"
//   ) {
//     setMessage(text);
//     setMessageType(type);
//   }

//   function toggleLead(id: number) {
//     setSelectedLeads((current) =>
//       current.includes(id)
//         ? current.filter(
//             (leadId) => leadId !== id
//           )
//         : [...current, id]
//     );
//   }

//   function toggleAllVisible() {
//     if (allVisibleSelected) {
//       const visibleIds = new Set(
//         filteredLeads.map((lead) => lead.id)
//       );

//       setSelectedLeads((current) =>
//         current.filter(
//           (id) => !visibleIds.has(id)
//         )
//       );

//       return;
//     }

//     setSelectedLeads((current) => {
//       const next = new Set(current);

//       filteredLeads.forEach((lead) => {
//         next.add(lead.id);
//       });

//       return Array.from(next);
//     });
//   }

//   function handleAddTemplate() {
//     const name = templateName.trim();
//     const subject = templateSubject.trim();
//     const body = templateBody.trim();

//     if (!name || !subject || !body) {
//       showMessage(
//         "Template name, subject and message are required.",
//         "error"
//       );
//       return;
//     }

//     const newTemplate: EmailTemplate = {
//       id: `template-${Date.now()}`,
//       name,
//       subject,
//       body,
//     };

//     setTemplates((current) => [
//       ...current,
//       newTemplate,
//     ]);

//     setSelectedTemplateId(newTemplate.id);

//     setTemplateName("");
//     setTemplateSubject("");
//     setTemplateBody("");
//     setShowTemplateForm(false);

//     showMessage(
//       "Email template added.",
//       "success"
//     );
//   }

//   async function handleScheduleEmails() {
//     if (selectedLeads.length === 0) {
//       showMessage(
//         "Select at least one lead.",
//         "error"
//       );
//       return;
//     }

//     if (!selectedTemplate) {
//       showMessage(
//         "Select an email template.",
//         "error"
//       );
//       return;
//     }

//     if (!selectedSender) {
//       showMessage(
//         "Select a sender.",
//         "error"
//       );
//       return;
//     }

//     if (!scheduleDate || !scheduleTime) {
//       showMessage(
//         "Select schedule date and time.",
//         "error"
//       );
//       return;
//     }

//     const scheduledAt = new Date(
//       `${scheduleDate}T${scheduleTime}`
//     );

//     if (Number.isNaN(scheduledAt.getTime())) {
//       showMessage(
//         "Invalid schedule date or time.",
//         "error"
//       );
//       return;
//     }

//     if (scheduledAt.getTime() <= Date.now()) {
//       showMessage(
//         "Schedule time must be in the future.",
//         "error"
//       );
//       return;
//     }

//     try {
//       setScheduling(true);
//       setMessage("");

//       const leadIds = [...selectedLeads];

//       const results = await Promise.allSettled(
//         leadIds.map(async (leadId) => {
//           const response = await fetch(
//             `/api/leads/${leadId}`,
//             {
//               method: "PATCH",
//               headers: {
//                 "Content-Type":
//                   "application/json",
//               },
//               body: JSON.stringify({
//                 emailStatus: "scheduled",
//                 emailScheduledAt:
//                   scheduledAt.toISOString(),

//                 // Stored for the future n8n workflow.
//                 emailTemplateId:
//                   selectedTemplate.id,

//                 emailTemplateName:
//                   selectedTemplate.name,

//                 emailSubject:
//                   selectedTemplate.subject,

//                 emailSenderId:
//                   selectedSender.id,

//                 emailSenderName:
//                   selectedSender.name,

//                 emailSenderAddress:
//                   selectedSender.email,
//               }),
//             }
//           );

//           const data =
//             await readApiResponse(response);

//           if (!response.ok) {
//             throw new Error(
//               data.error ||
//                 `Failed to schedule lead ${leadId}.`
//             );
//           }

//           return leadId;
//         })
//       );

//       const successfulIds = results
//         .filter(
//           (
//             result
//           ): result is PromiseFulfilledResult<number> =>
//             result.status === "fulfilled"
//         )
//         .map((result) => result.value);

//       const failedCount =
//         results.length - successfulIds.length;

//       if (successfulIds.length > 0) {
//         setLeads((current) =>
//           current.filter(
//             (lead) =>
//               !successfulIds.includes(lead.id)
//           )
//         );

//         setSelectedLeads((current) =>
//           current.filter(
//             (id) =>
//               !successfulIds.includes(id)
//           )
//         );
//       }

//       if (failedCount > 0) {
//         showMessage(
//           `${successfulIds.length} scheduled successfully. ${failedCount} failed.`,
//           successfulIds.length > 0
//             ? "info"
//             : "error"
//         );
//       } else {
//         showMessage(
//           `${successfulIds.length} email${
//             successfulIds.length === 1
//               ? ""
//               : "s"
//           } scheduled successfully.`,
//           "success"
//         );
//       }
//     } catch (error) {
//       showMessage(
//         error instanceof Error
//           ? error.message
//           : "Failed to schedule emails.",
//         "error"
//       );
//     } finally {
//       setScheduling(false);
//     }
//   }

//   return (
//     <div className="w-full space-y-3">
//       {/* Page Header */}
//       <div className="flex items-center justify-between gap-3">
//         <div className="min-w-0">
//           <div className="flex items-center gap-2">
//             <Mail
//               size={18}
//               className="text-blue-400"
//             />

//             <h1 className="text-xl font-semibold tracking-tight text-white">
//               Email Outreach
//             </h1>
//           </div>

//           <p className="mt-0.5 text-xs text-slate-500">
//             Select verified leads and schedule
//             personalized emails.
//           </p>
//         </div>

//         <button
//           type="button"
//           onClick={() =>
//             void fetchLeads(
//               activeTab,
//               false
//             )
//           }
//           title="Refresh"
//           disabled={refreshing}
//           className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-500 transition hover:border-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
//         >
//           <RefreshCw
//             size={13}
//             className={
//               refreshing
//                 ? "animate-spin"
//                 : ""
//             }
//           />
//         </button>
//       </div>

//       {/* Stats / Tabs */}
//       <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10">
//         <div className="flex items-center overflow-x-auto border-b border-slate-800 bg-slate-950/40">
//           {TABS.map((tab) => {
//             const active =
//               activeTab === tab.key;

//             return (
//               <button
//                 key={tab.key}
//                 type="button"
//                 onClick={() => {
//                   setActiveTab(tab.key);
//                   setSelectedLeads([]);
//                   setSearchQuery("");
//                   setMessage("");
//                 }}
//                 className={`relative shrink-0 px-4 py-3 text-[10px] font-semibold transition ${
//                   active
//                     ? "text-blue-400"
//                     : "text-slate-500 hover:text-slate-300"
//                 }`}
//               >
//                 {tab.label}

//                 {active && (
//                   <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue-400" />
//                 )}
//               </button>
//             );
//           })}
//         </div>

//         {/* Toolbar */}
//         <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
//           <div className="flex items-center gap-2">
//             <div>
//               <h2 className="text-xs font-semibold text-white">
//                 {TABS.find(
//                   (tab) =>
//                     tab.key === activeTab
//                 )?.label || "Email Outreach"}
//               </h2>

//               <p className="mt-0.5 text-[10px] text-slate-500">
//                 {leads.length} lead
//                 {leads.length === 1
//                   ? ""
//                   : "s"}
//               </p>
//             </div>

//             <div className="hidden items-center gap-1 rounded-md border border-emerald-500/15 bg-emerald-500/5 px-2 py-1 text-[9px] font-medium text-emerald-400 sm:flex">
//               <CheckCircle2 size={10} />
//               Verified
//             </div>
//           </div>

//           <div className="relative w-[280px] max-w-[45vw]">
//             <Search
//               size={14}
//               className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"
//             />

//             <input
//               type="text"
//               value={searchQuery}
//               onChange={(event) =>
//                 setSearchQuery(
//                   event.target.value
//                 )
//               }
//               placeholder="Search website, email, sector..."
//               className="h-8 w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 text-[11px] text-slate-300 outline-none transition placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10"
//             />
//           </div>
//         </div>

//         {/* Status Message */}
//         {message && (
//           <div
//             className={`border-b px-3 py-2 ${
//               messageType === "error"
//                 ? "border-red-500/10 bg-red-500/5"
//                 : messageType === "success"
//                   ? "border-emerald-500/10 bg-emerald-500/5"
//                   : "border-slate-800 bg-slate-950/40"
//             }`}
//           >
//             <p
//               className={`text-[10px] ${
//                 messageType === "error"
//                   ? "text-red-400"
//                   : messageType === "success"
//                     ? "text-emerald-400"
//                     : "text-slate-400"
//               }`}
//             >
//               {message}
//             </p>
//           </div>
//         )}

//         {/* Leads Table */}
//         {loading ? (
//           <div className="flex h-[calc(100vh-390px)] min-h-[260px] items-center justify-center">
//             <div className="flex items-center gap-2 text-xs text-slate-500">
//               <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
//               Loading email leads...
//             </div>
//           </div>
//         ) : (
//           <div className="leads-scroll max-h-[calc(100vh-390px)] min-h-[260px] overflow-auto">
//             <table className="w-full min-w-[1050px] border-collapse text-left">
//               <thead className="sticky top-0 z-30">
//                 <tr className="border-b border-slate-800 bg-slate-950">
//                   <th className="sticky left-0 z-40 w-10 border-r border-slate-800 bg-slate-950 px-2.5 py-2">
//                     <input
//                       type="checkbox"
//                       checked={allVisibleSelected}
//                       onChange={toggleAllVisible}
//                       className="h-3.5 w-3.5 accent-blue-500"
//                       aria-label="Select all visible leads"
//                     />
//                   </th>

//                   <th className="w-[180px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Sector
//                   </th>

//                   <th className="w-[220px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Website
//                   </th>

//                   <th className="w-[250px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Email
//                   </th>

//                   <th className="w-[190px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Location
//                   </th>

//                   {activeTab === "scheduled" && (
//                     <th className="w-[180px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                       Scheduled At
//                     </th>
//                   )}

//                   {activeTab === "sent" && (
//                     <th className="w-[180px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                       Sent At
//                     </th>
//                   )}

//                   {activeTab === "failed" && (
//                     <th className="w-[260px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                       Error
//                     </th>
//                   )}
//                 </tr>
//               </thead>

//               <tbody className="divide-y divide-slate-800/80">
//                 {filteredLeads.length === 0 ? (
//                   <tr>
//                     <td
//                       colSpan={
//                         activeTab === "pending"
//                           ? 5
//                           : 6
//                       }
//                       className="h-[240px] px-4 text-center"
//                     >
//                       <div className="flex flex-col items-center justify-center gap-2">
//                         <Mail
//                           size={22}
//                           className="text-slate-700"
//                         />

//                         <p className="text-xs text-slate-500">
//                           {searchQuery
//                             ? "No leads match your search."
//                             : activeTab ===
//                                 "pending"
//                               ? "No verified leads are ready to send."
//                               : `No ${activeTab} email records found.`}
//                         </p>

//                         {searchQuery && (
//                           <button
//                             type="button"
//                             onClick={() =>
//                               setSearchQuery("")
//                             }
//                             className="text-[10px] text-blue-400 hover:text-blue-300"
//                           >
//                             Clear search
//                           </button>
//                         )}
//                       </div>
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredLeads.map(
//                     (lead) => (
//                       <tr
//                         key={lead.id}
//                         className="group h-10 transition hover:bg-slate-800/35"
//                       >
//                         <td className="sticky left-0 z-20 border-r border-slate-800/80 bg-slate-900 px-2.5 py-2 group-hover:bg-slate-800/80">
//                           {activeTab ===
//                           "pending" ? (
//                             <input
//                               type="checkbox"
//                               checked={selectedLeads.includes(
//                                 lead.id
//                               )}
//                               onChange={() =>
//                                 toggleLead(
//                                   lead.id
//                                 )
//                               }
//                               className="h-3.5 w-3.5 accent-blue-500"
//                               aria-label={`Select ${lead.email}`}
//                             />
//                           ) : (
//                             <CheckCircle2
//                               size={13}
//                               className="text-emerald-500/60"
//                             />
//                           )}
//                         </td>

//                         <td className="max-w-[180px] px-2.5 py-2">
//                           <span className="block truncate text-[11px] font-medium text-slate-200">
//                             {lead.sector ||
//                               "—"}
//                           </span>
//                         </td>

//                         <td className="px-2.5 py-2">
//                           <span
//                             className="block max-w-[215px] truncate text-[11px] text-blue-400"
//                             title={
//                               lead.website
//                             }
//                           >
//                             {lead.website ||
//                               "—"}
//                           </span>
//                         </td>

//                         <td className="px-2.5 py-2">
//                           <span
//                             className="block max-w-[245px] truncate text-[11px] text-slate-300"
//                             title={lead.email}
//                           >
//                             {lead.email}
//                           </span>
//                         </td>

//                         <td className="max-w-[190px] px-2.5 py-2">
//                           <span
//                             className="block max-w-[185px] truncate text-[11px] text-slate-400"
//                             title={
//                               lead.location
//                             }
//                           >
//                             {lead.location ||
//                               "—"}
//                           </span>
//                         </td>

//                         {activeTab ===
//                           "scheduled" && (
//                           <td className="px-2.5 py-2">
//                             <span className="text-[10px] text-amber-400">
//                               {formatDateTime(
//                                 lead.emailScheduledAt
//                               )}
//                             </span>
//                           </td>
//                         )}

//                         {activeTab ===
//                           "sent" && (
//                           <td className="px-2.5 py-2">
//                             <span className="text-[10px] text-emerald-400">
//                               {formatDateTime(
//                                 lead.emailSentAt
//                               )}
//                             </span>
//                           </td>
//                         )}

//                         {activeTab ===
//                           "failed" && (
//                           <td className="max-w-[260px] px-2.5 py-2">
//                             <span
//                               className="block max-w-[250px] truncate text-[10px] text-red-400"
//                               title={
//                                 lead.emailError ||
//                                 ""
//                               }
//                             >
//                               {lead.emailError ||
//                                 "Email sending failed."}
//                             </span>
//                           </td>
//                         )}
//                       </tr>
//                     )
//                   )
//                 )}
//               </tbody>
//             </table>
//           </div>
//         )}

//         {/* Schedule Panel */}
//         {activeTab === "pending" &&
//           !loading &&
//           leads.length > 0 && (
//             <div className="border-t border-slate-800 bg-slate-950/50 p-3">
//               <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
//                 {/* Template */}
//                 <div>
//                   <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Email Template
//                   </label>

//                   <div className="flex gap-1.5">
//                     <div className="relative flex-1">
//                       <select
//                         value={
//                           selectedTemplateId
//                         }
//                         onChange={(event) =>
//                           setSelectedTemplateId(
//                             event.target.value
//                           )
//                         }
//                         className="h-8 w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 pr-8 text-[10px] text-slate-300 outline-none focus:border-blue-500/50"
//                       >
//                         {templates.map(
//                           (template) => (
//                             <option
//                               key={
//                                 template.id
//                               }
//                               value={
//                                 template.id
//                               }
//                             >
//                               {template.name}
//                             </option>
//                           )
//                         )}
//                       </select>

//                       <ChevronDown
//                         size={12}
//                         className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600"
//                       />
//                     </div>

//                     <button
//                       type="button"
//                       onClick={() =>
//                         setShowTemplateForm(
//                           true
//                         )
//                       }
//                       title="Add template"
//                       className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-500 transition hover:border-blue-500/30 hover:text-blue-400"
//                     >
//                       <Plus size={13} />
//                     </button>
//                   </div>
//                 </div>

//                 {/* Sender */}
//                 <div>
//                   <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Send From
//                   </label>

//                   <div className="relative">
//                     <select
//                       value={
//                         selectedSenderId
//                       }
//                       onChange={(event) =>
//                         setSelectedSenderId(
//                           event.target.value
//                         )
//                       }
//                       className="h-8 w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 pr-8 text-[10px] text-slate-300 outline-none focus:border-blue-500/50"
//                     >
//                       {senders.map(
//                         (sender) => (
//                           <option
//                             key={sender.id}
//                             value={sender.id}
//                           >
//                             {sender.name} —{" "}
//                             {sender.email}
//                           </option>
//                         )
//                       )}
//                     </select>

//                     <ChevronDown
//                       size={12}
//                       className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600"
//                     />
//                   </div>
//                 </div>

//                 {/* Schedule */}
//                 <div>
//                   <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                     Schedule
//                   </label>

//                   <div className="flex gap-1.5">
//                     <input
//                       type="date"
//                       value={scheduleDate}
//                       onChange={(event) =>
//                         setScheduleDate(
//                           event.target.value
//                         )
//                       }
//                       className="h-8 min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] text-slate-300 outline-none focus:border-blue-500/50"
//                     />

//                     <input
//                       type="time"
//                       value={scheduleTime}
//                       onChange={(event) =>
//                         setScheduleTime(
//                           event.target.value
//                         )
//                       }
//                       className="h-8 w-[100px] rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] text-slate-300 outline-none focus:border-blue-500/50"
//                     />
//                   </div>
//                 </div>

//                 {/* Schedule Button */}
//                 <div className="flex items-end">
//                   <button
//                     type="button"
//                     onClick={() =>
//                       void handleScheduleEmails()
//                     }
//                     disabled={
//                       scheduling ||
//                       selectedLeads.length === 0
//                     }
//                     className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[10px] font-semibold text-white shadow-md shadow-blue-600/15 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
//                   >
//                     {scheduling ? (
//                       <>
//                         <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-white" />
//                         Scheduling...
//                       </>
//                     ) : (
//                       <>
//                         <Clock3 size={12} />
//                         Schedule
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </div>

//               {/* Selection Info */}
//               <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
//                 <p className="text-[9px] text-slate-600">
//                   {selectedLeads.length} lead
//                   {selectedLeads.length === 1
//                     ? ""
//                     : "s"} selected
//                 </p>

//                 {selectedTemplate && (
//                   <p className="truncate text-[9px] text-slate-600">
//                     Template:{" "}
//                     <span className="text-slate-500">
//                       {selectedTemplate.name}
//                     </span>
//                   </p>
//                 )}
//               </div>
//             </div>
//           )}
//       </section>

//       {/* Template Modal */}
//       {showTemplateForm && (
//         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
//           <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
//             <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
//               <div>
//                 <h3 className="text-sm font-semibold text-white">
//                   Add Email Template
//                 </h3>

//                 <p className="mt-0.5 text-[10px] text-slate-500">
//                   Create a reusable outreach
//                   template.
//                 </p>
//               </div>

//               <button
//                 type="button"
//                 onClick={() =>
//                   setShowTemplateForm(false)
//                 }
//                 className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-900 hover:text-slate-200"
//               >
//                 <X size={14} />
//               </button>
//             </div>

//             <div className="space-y-3 p-4">
//               <div>
//                 <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                   Template Name
//                 </label>

//                 <input
//                   type="text"
//                   value={templateName}
//                   onChange={(event) =>
//                     setTemplateName(
//                       event.target.value
//                     )
//                   }
//                   placeholder="Industrial IoT Pitch"
//                   className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-[11px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
//                 />
//               </div>

//               <div>
//                 <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                   Subject
//                 </label>

//                 <input
//                   type="text"
//                   value={templateSubject}
//                   onChange={(event) =>
//                     setTemplateSubject(
//                       event.target.value
//                     )
//                   }
//                   placeholder="Industrial IoT Solutions for {{company_name}}"
//                   className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-[11px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
//                 />
//               </div>

//               <div>
//                 <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">
//                   Message
//                 </label>

//                 <textarea
//                   value={templateBody}
//                   onChange={(event) =>
//                     setTemplateBody(
//                       event.target.value
//                     )
//                   }
//                   rows={9}
//                   placeholder={`Hello {{company_name}},\n\nYour email content...`}
//                   className="w-full resize-y rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-[11px] leading-5 text-slate-300 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
//                 />

//                 <p className="mt-1.5 text-[9px] text-slate-600">
//                   Available variables:
//                   {" "}
//                   {"{{company_name}}"} ·
//                   {" "}
//                   {"{{sector}}"} ·
//                   {" "}
//                   {"{{website}}"} ·
//                   {" "}
//                   {"{{location}}"}
//                 </p>
//               </div>

//               <div className="flex justify-end gap-2 pt-1">
//                 <button
//                   type="button"
//                   onClick={() =>
//                     setShowTemplateForm(false)
//                   }
//                   className="h-8 rounded-lg border border-slate-800 bg-slate-900 px-3 text-[10px] font-medium text-slate-400 transition hover:text-slate-200"
//                 >
//                   Cancel
//                 </button>

//                 <button
//                   type="button"
//                   onClick={handleAddTemplate}
//                   className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[10px] font-semibold text-white transition hover:bg-blue-500"
//                 >
//                   <Plus size={12} />
//                   Add Template
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }