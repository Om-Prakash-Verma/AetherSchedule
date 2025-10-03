# AetherSchedule - Intelligent Timetabling & Academic Simulation

**AetherSchedule is a next-generation, AI-powered academic operations platform designed for the complex needs of higher-education institutes.** It moves beyond simple scheduling to create a "Digital Twin" of your institution, leveraging a proactive, multi-layered AI engine, powered by the Google Gemini API, to simulate, optimize, and analyze timetables.

This application provides a full-stack solution, from a cohesive black glassmorphism UI to a robust backend, demonstrating an end-to-end scheduling, management, and analytics ecosystem.

---

## Core Features

AetherSchedule is a complete ecosystem designed to address the entire scheduling lifecycle with state-of-the-art intelligence.

### 🧠 Core Intelligence & Scheduling Engine
- **Proactive AI Diagnostics:** Before scheduling, a "Pre-flight Check" analyzes all data to identify potential bottlenecks, faculty shortages, or impossible constraint combinations, providing actionable warnings to prevent failures.
- **Guided Interactive Evolution:** The AI quickly generates a high-quality draft, which users can then refine collaboratively. Lock in preferred parts of the schedule and have the AI re-optimize the rest around your decisions.
- **Natural Language Command Bar:** Instruct the AI with plain English commands like *"Try to move all of Dr. Smith's classes to the afternoon,"* and watch it attempt the changes and report on the impact.
- **Three-Level Gemini Integration:** Goes beyond simple AI. Gemini acts as a self-tuning judge (learning from faculty feedback), a master strategist (devising a custom plan for the algorithm), and a creative problem-solver (intervening to break optimization deadlocks).
- **Conflict-Free by Design:** Hard constraints are the bedrock of the engine. All generated solutions are guaranteed to be free of faculty, room, and batch clashes.

### 📊 Advanced Analytics & Reporting
- **Interactive Analytics Dashboard:** The old "Reports" page is now a dynamic dashboard with heatmaps for room utilization, detailed faculty workload distribution charts, and student "schedule quality" scores.
- **Gemini-Powered Impact Analysis:** Compare any two timetable versions and receive an AI-generated qualitative report summarizing the key differences and predicting their impact on students and faculty (e.g., "Version 2 improves faculty workload balance by 15% but slightly increases student gaps on Tuesdays. Overall, it represents a significant improvement in resource efficiency.").

### ⚙️ Comprehensive Scheduling & Control
- **Multi-Batch Master Scheduling:** Generate complex master timetables that seamlessly coordinate schedules across multiple batches, semesters, and entire departments.
- **Interactive Visual Editor:** Manually refine AI-generated drafts with an intuitive drag-and-drop interface, giving you the perfect blend of automation and human control.
- **Real-Time Conflict Highlighting:** The visual editor instantly flags any manual change that creates a conflict with a detailed tooltip, preventing errors before they happen.
- **Full Version Control & Collaborative Workflow:** A multi-step process (`Draft` → `Submitted` → `Approved`/`Rejected`) with role-based permissions, integrated commenting, and version history ensures schedules are properly vetted.

### 🧑‍🏫 Intelligent Substitute Management
- **AI-Powered Recommendations:** Instantly finds and ranks the best-suited substitute teachers for a last-minute absence. The ranking considers not just availability but also real-time workload, schedule compactness, and subject expertise.
- **Context-Aware Candidate Pooling:** The pool of potential substitutes is intelligently restricted to teachers already allocated to that specific batch, ensuring substitutes are familiar with the student group and curriculum.

### 🔒 Granular & AI-Assisted Constraint Management
- **Faculty Availability Matrix:** A simple, visual point-and-click matrix to define preferred and unavailable time slots for each faculty member.
- **Pinned Assignments & Planned Leaves:** Lock in mandatory, non-negotiable events or block out dates for faculty holidays to ensure the AI respects all real-world constraints.
- **Multi-Teacher Lab Assignments:** Accurately models real-world scenarios by allowing the assignment of two or more teachers to a single lab or practical session.

### 🗂️ Centralized Data & User Administration
- **Unified Data Hub:** A single source of truth for all institutional data: Subjects, Faculty, Rooms, Batches, and Departments, with full CRUD functionality.
- **Automated Account Provisioning:** New faculty, batches, and departments automatically have corresponding user accounts (for login, HOD roles, and student representatives) created, streamlining user management.
- **Data Portability & System Reset:** Full import/export of foundational data via JSON, plus a secure 'danger zone' feature for SuperAdmins to reset the database.
- **Role-Based Access Control (RBAC):** A robust permission system ensures users only see and interact with the features relevant to their role.

### 📊 User Experience & Reporting
- **Personalized Timetable Views:** Students and faculty log in to see a clean, personalized view of only their own approved schedule, updated in real-time with any substitutions.
- **Faculty Feedback Loop:** Faculty can rate their schedules, providing crucial data that the Gemini AI uses to self-tune and improve future results.
- **Versatile Export Options:** Export approved timetables to PDF, CSV, or ICS for one-click import into calendar applications.

---

## 📖 Project Documentation

This repository contains a dedicated `/documentation` directory with detailed, plain-text files explaining every aspect of the application. This is the best place to start for a deep understanding of the project.

- **01-Project_Setup.txt**: How to set up and run the project locally.
- **02-Frontend_Architecture.txt**: An overview of the React component structure, state management, and styling.
- **03-Backend_API.txt**: A guide to the Hono API, including routing and database interaction.
- **04-Database_Schema.txt**: Detailed explanation of the Drizzle ORM schema and table relationships.
- **05-Core_Scheduler_Engine.txt**: A deep dive into the genetic algorithm and optimization logic.
- **06-AI_Integration_Gemini.txt**: Explains the "Three-Level" Gemini strategy and other AI features.
- **07-Key_Features_Walkthrough.txt**: A user-centric guide to the main workflows of the application.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **State Management:** TanStack Query (for server state), React Context (for global UI state)
- **Backend/API:** Hono on Node.js (local) / Vercel Edge (deployment)
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
git clone https://github.com/your-username/aetherschedule.git
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
# Get this from your Neon database project settings.
# IMPORTANT: Use the non-pooling, standard connection string for Drizzle Kit compatibility.
POSTGRES_URL="postgres://user:password@host/dbname"

# Get this from Google AI Studio
API_KEY="your_gemini_api_key_here"
```

### 4. Run the Development Server
This single command handles everything. It will first **synchronize your database schema**, **seed it with demo data** (if empty), and then concurrently start the Hono API backend and the Vite frontend development server.

```bash
npm run dev
```

- The Hono API will be running on `http://localhost:8787`
- The Vite frontend will open on `http://localhost:5173` (or another port if 5173 is busy).

The application should now be running locally! The first time you access the app, it will automatically seed the database with initial demo data.

---
**Note on Manual Database Pushing:** The `npm run dev` script handles pushing the schema automatically on startup. If you ever need to sync schema changes *while the dev server is already running*, you can use the following command in a separate terminal:
```bash
npm run db:push
```
---


## 📂 Project Structure

```
.
├── api/                  # Hono backend server
│   ├── index.ts          # Vercel deployment entrypoint
│   └── server.ts         # Main Hono app, routes, and logic
├── core/                 # Core business logic (scheduling, analytics)
│   ├── engine/           # Modular components of the scheduler engine
│   ├── analyticsEngine.ts
│   ├── conflictChecker.ts
│   └── schedulerEngine.ts # High-level orchestrator for the GA
├── db/                   # Database schema and client
│   └── schema.ts         # Drizzle ORM schema definitions
├── documentation/        # Detailed project documentation files
├── drizzle/              # Drizzle-Kit migration output
├── public/               # Static assets
├── src/                  # React frontend application
│   ├── components/       # Reusable UI components
│   ├── context/          # React Context for global state
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page-level components
│   ├── services/         # API service layer (data fetching)
│   ├── types.ts          # Global TypeScript type definitions
│   └── index.tsx         # React app entry point
├── .env                  # Local environment variables (ignored by git)
├── package.json
└── vite.config.ts        # Vite configuration
```