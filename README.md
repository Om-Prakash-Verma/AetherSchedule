# AetherSchedule - Intelligent Timetabling

**AetherSchedule is a smart, AI-powered timetable scheduling platform designed for the complex needs of higher-education institutes.** It leverages a self-tuning, multi-layered AI engine, powered by the Google Gemini API, to generate optimized, conflict-free timetable candidates in minutes, not weeks.

This application provides a full-stack solution, from a cohesive black glassmorphism UI to a robust backend, demonstrating an end-to-end scheduling and management ecosystem.

---

## Core Features

AetherSchedule is a complete ecosystem designed to address the entire scheduling lifecycle.

### 🧠 Core Intelligence & Scheduling Engine
- **Hyper-Heuristic Genetic Algorithm:** The core evolutionary engine intelligently breeds, mutates, and evolves millions of potential timetables to find the fittest solutions, solving a problem that is computationally impossible for humans.
- **Three-Level Gemini Integration:** Goes beyond simple AI. Gemini acts as a self-tuning judge (learning from faculty feedback), a master strategist (devising a custom plan for the algorithm), and a creative problem-solver (intervening to break optimization deadlocks).
- **Multi-Candidate Generation:** Produces several distinct, high-quality timetable candidates, each with a detailed scorecard, empowering administrators with the power of informed choice.
- **Conflict-Free by Design:** Hard constraints are the bedrock of the engine. All generated solutions are guaranteed to be free of faculty, room, and batch clashes.

### ⚙️ Comprehensive Scheduling & Control
- **Multi-Batch Master Scheduling:** Generate complex master timetables that seamlessly coordinate schedules across multiple batches, semesters, and entire departments.
- **Interactive Visual Editor:** Manually refine AI-generated drafts with an intuitive drag-and-drop interface, giving you the perfect blend of automation and human control.
- **Real-Time Conflict Highlighting:** The visual editor instantly flags any manual change that creates a faculty or room conflict with a detailed tooltip, preventing errors before they happen.
- **Full Version Control:** Save multiple drafts for any timetable, allowing for easy comparison, iteration, and rollback to previous versions.
- **Collaborative Approval Workflow:** A multi-step process (`Draft` → `Submitted` → `Approved`/`Rejected`) with role-based permissions ensures schedules are properly vetted by all stakeholders.
- **Integrated Commenting System:** Department heads and managers can leave timestamped comments directly on timetable drafts, centralizing all feedback in one place.

### 🧑‍🏫 Intelligent Substitute Management
- **AI-Powered Recommendations:** Instantly finds and ranks the best-suited substitute teachers for a last-minute absence. The ranking considers not just availability but also real-time workload, schedule compactness, and subject expertise.
- **Context-Aware Candidate Pooling:** The pool of potential substitutes is intelligently restricted to teachers already allocated to that specific batch, ensuring substitutes are familiar with the student group and curriculum.

### 🔒 Granular Constraint Management
- **Faculty Availability Matrix:** A simple, visual point-and-click matrix to define preferred and unavailable time slots for each faculty member.
- **Pinned Assignments & Planned Leaves:** Lock in mandatory, non-negotiable events or block out dates for faculty holidays to ensure the AI respects all real-world constraints.
- **Batch-Specific Room Allocations:** Restrict a batch's classes to a specific set of pre-assigned rooms, giving administrators fine-grained control over resource usage.
- **Multi-Teacher Lab Assignments:** Accurately models real-world scenarios by allowing the assignment of two or more teachers to a single lab or practical session. The AI will ensure all assigned teachers are available simultaneously.

### 🗂️ Centralized Data & User Administration
- **Unified Data Hub:** A single source of truth for all institutional data: Subjects, Faculty, Rooms, Batches, and Departments, with full CRUD functionality.
- **Data Portability:** Full import and export of all foundational data (including users) via JSON, allowing for easy backups, migrations, or offline editing.
- **Role-Based Access Control (RBAC):** A robust permission system ensures users only see and interact with the features relevant to their role (Admin, Manager, HOD, Faculty, Student).
- **System Reset Functionality:** A secure 'danger zone' feature for SuperAdmins to reset the application database to its initial seed state.

### 📊 User Experience & Reporting
- **Personalized Timetable Views:** Students and faculty log in to see a clean, personalized view of only their own approved schedule, updated in real-time with any substitutions.
- **Faculty Feedback Loop:** Faculty can rate their schedules, providing crucial data that the Gemini AI uses to self-tune and improve future results.
- **Versatile Export Options:** Export approved timetables to CSV for spreadsheets or ICS for one-click import into calendar applications.
- **Insightful Reports:** Access detailed reports on key metrics like room utilization and faculty workload to make data-driven administrative decisions.

---

## 🤖 The AI Engine: A Deeper Look

The engine employs a sophisticated, multi-layered strategy, combining a battle-tested **Genetic Algorithm** with the cutting-edge intelligence of the **Google Gemini API**.

- **Level 1: The Self-Tuning Judge:** Gemini analyzes feedback from past timetables (e.g., faculty ratings) to dynamically adjust the fitness function, allowing the system to learn and adapt over time.
- **Level 2: The Master Strategist:** Before the evolution begins, Gemini creates a custom, multi-phase game plan for the Genetic Algorithm, ensuring the most efficient path to a solution.
- **Level 3: The Creative Interventionist:** If the algorithm gets stuck, it sends the problematic timetable to Gemini. Gemini analyzes the deadlock and suggests a creative structural change to get the evolutionary process moving again.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend/API:** Hono on Vercel Edge Functions
- **Database:** Neon (Serverless Postgres) with Drizzle ORM
- **AI:** Google Gemini API
- **Deployment:** Vercel

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18 or later)
- npm (or your preferred package manager)
- A Neon database project.
- A Google Gemini API Key.

### 1. Clone the Repository
```bash
git clone https://github.com/om-prakash-verma/aetherschedule.git
cd aetherschedule
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root of the project by copying the example:
```bash
# This command is for Linux/macOS. For Windows, use 'copy' instead of 'cp'.
cp .env.example .env
```

Now, open the `.env` file and add your credentials:

```env
# Get this from your Neon database project settings (use the non-pooling connection string)
POSTGRES_URL="postgres://user:password@host/dbname"

# Get this from Google AI Studio
API_KEY="your_gemini_api_key_here"
```

### 4. Run the Development Server
This single command handles everything. It will first **synchronize your database schema** and then concurrently start the Hono API backend and the Vite frontend development server.

```bash
npm run dev
```

- The Hono API will be running on `http://localhost:8787`
- The Vite frontend will open on `http://localhost:5173` (or another port if 5173 is busy).

The application should now be running locally! The first time you access the app, it will automatically seed the database with initial demo data.

---
**Note on Manual Database Pushing:** The `npm run dev` script now handles pushing the schema automatically. If you ever need to do it manually (e.g., after changing the schema while the dev server is running), you can use the following command in a separate terminal:
```bash
npm run db:push
```
---


## 📂 Project Structure

```
.
├── api/                  # Hono backend server
│   ├── index.ts          # Vercel entrypoint
│   └── server.ts         # Main Hono app, routes, and logic
├── db/                   # Database schema
│   └── schema.ts         # Drizzle ORM schema definitions
├── drizzle/              # Drizzle-Kit migration output
├── public/               # Static assets
├── src/                  # React frontend application
│   ├── components/       # Reusable UI components
│   ├── constants.ts      # App-wide constants
│   ├── context/          # React Context for global state
│   ├── core/             # Core business logic (scheduling engine, conflict checker)
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page-level components
│   ├── services/         # API service layer (data fetching)
│   ├── types.ts          # TypeScript type definitions
│   └── index.tsx         # React app entry point
├── .env                  # Local environment variables (ignored by git)
├── drizzle.config.ts     # Drizzle Kit configuration
├── package.json
└── vite.config.ts        # Vite configuration
```