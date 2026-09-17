export type ResearchStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface ResearchLead {
  sector: string;
  website: string;
  location: string;
  phone: string;
  email: string;
  googleBusinessProfile: string;
}

export interface ResearchRequest {
  prompt: string;
}

export interface ResearchJob {
  id: string;
  prompt: string;
  status: ResearchStatus;
  leadsFound: number;
  createdAt: string;
}