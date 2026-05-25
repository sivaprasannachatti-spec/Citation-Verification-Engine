export interface LegalMatter {
  id: number;
  title: string;
  practice: string;
  court: string;
  query: string;
  badgeColor: string;
}

export const LEGAL_MATTERS: LegalMatter[] = [
  {
    id: 1,
    title: "Anticipatory Bail Precedents",
    practice: "Criminal",
    court: "Delhi High Court",
    query: "Key SC precedents on anticipatory bail in economic offences",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20"
  },
  {
    id: 2,
    title: "Draft Cheating Complaint",
    practice: "Criminal",
    court: "Delhi Metropolitan Magistrate",
    query: "Draft complaint for cheating under Section 420 IPC",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20"
  },
  {
    id: 3,
    title: "NDPS Bail Memo",
    practice: "Criminal",
    court: "Supreme Court",
    query: "Summarize SC approach to bail in NDPS cases over last 5 years",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20"
  },
  {
    id: 4,
    title: "Criminal Revision BNSS",
    practice: "Criminal",
    court: "Delhi High Court",
    query: "Key Delhi HC decisions on Section 482 BNSS powers in last 2 years",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20"
  },
  {
    id: 5,
    title: "Corporate NDA Review",
    practice: "Corporate",
    court: "Transactional",
    query: "Review NDA and flag missing clauses for Indian law",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  },
  {
    id: 6,
    title: "Shareholders Dispute",
    practice: "Corporate",
    court: "NCLT Delhi",
    query: "Grounds for NCLT petition — oppression and mismanagement",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  },
  {
    id: 7,
    title: "Property Specific Performance",
    practice: "Property",
    court: "Civil Court Delhi",
    query: "Specific performance of immovable property sale agreement",
    badgeColor: "bg-green-500/10 text-green-500 border-green-500/20"
  },
  {
    id: 8,
    title: "Mutual Consent Divorce",
    practice: "Family",
    court: "Supreme Court",
    query: "SC guidelines on waiving the 6-month cooling-off period under Section 13B Hindu Marriage Act",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  }
];