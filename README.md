uniconverge-lead-outreach/
│
├── app/
│   ├── page.tsx                 ← Research screen
│   │
│   ├── research/
│   │   └── page.tsx             ← Research form/results
│   │
│   └── api/
│       └── research/
│           └── route.ts         ← Research request backend
│
├── components/
│   └── research/
│       ├── ResearchForm.tsx     ← Prompt/input UI
│       └── ResearchStatus.tsx   ← Research progress/status
│
├── lib/
│   ├── research.ts              ← Research business logic
│   └── google-sheets.ts         ← Google Sheets connection
│
└── types/
    └── research.ts              ← Research/lead data types