
<div align="center">

  <h1>✨ AetherSchedule</h1>
  <h3>The Intelligent Digital Twin for Academic Operations</h3>
  
  <p>
    <strong>Next-Generation Timetabling • AI-Powered Simulation • Real-Time Conflict Resolution</strong>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Gemini-3.0_Pro-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white" />
    <img src="https://img.shields.io/badge/Firebase-Functions-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  </p>

</div>

---

## 🚀 Overview

**AetherSchedule** is not just a calendar app; it is a **Digital Twin** of an educational institution. It models the complex constraints of faculty availability, room capacities, curriculum requirements, and time preferences to solve the classic **University Course Timetabling Problem (UCTP)**.

Powered by **Google Gemini 3.0 Pro (Reasoning)**, AetherSchedule acts as an expert constraint solver that can generate collision-free master schedules, optimize resource utilization, and perform "Pre-flight" diagnostics on your academic planning.

## ✨ Key Features

### 🧠 AI-Powered Core
*   **Gemini 3.0 Reasoning Engine:** Uses advanced prompt engineering to solve multi-dimensional constraints (Faculty vs. Room vs. Batch).
*   **Global Conflict Awareness:** The AI "sees" the schedules of all other batches while generating a timetable for a specific batch, preventing double-booking of shared resources.
*   **Smart Optimization Goals:** Distributes subjects across different times, groups labs, and manages faculty fatigue.
*   **Natural Language Assistant:** A "Copilot" chat interface allowing admins to query or modify the schedule using natural language.

### 📅 Advanced Scheduler
*   **Visual Grid:** Interactive, glassmorphism-styled timetable with support for custom time slots and breaks.
*   **Real-Time Conflict Detection:** Instantly flags overlaps (red cells) with detailed tooltips explaining the issue (e.g., *"Room 101 Double Booked"*).
*   **Multi-Teacher Support:** Assign multiple faculty members to a single slot (crucial for Labs/Practicals).
*   **Break Rendering:** Visualizes break times (e.g., Lunch, Recess) directly on the grid.

### 📊 Analytics & Portals
*   **Operations Dashboard:** Real-time KPIs for room utilization, faculty load, and schedule health scores.
*   **Advanced Analytics:** Interactive charts for Departmental Balance, Campus Congestion Heatmaps, and Operational Efficiency gauges.
*   **Student Portal:** Read-only view for students to find their batch schedules and room locations.
*   **Faculty Portal:** Dedicated view for staff to track their teaching hours and assigned classes.

### 🗂️ Resource Management
*   **Tabbed Interface:** Clean management for Faculty, Departments, Subjects, Rooms, and Batches.
*   **Deep Linking:** Assign specific **Teachers** to **Subjects** within a **Batch**.
*   **Lecture Frequency Control:** Define exactly how many **"Lectures Per Week"** a subject requires.

### 🛡️ Enterprise Security
*   **Role-Based Access:** Strict Admin vs. Public read-only permissions enforced via Firestore Rules.
*   **Secure Backend:** All AI generation and database writes occur in secure **Firebase Cloud Functions**, keeping API keys and logic hidden from the client.
*   **Rate Limiting:** Protects against abuse of the AI generation endpoints.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | High-performance component-based UI. |
| **Language** | TypeScript | Strict typing for robust academic data modeling. |
| **Styling** | Tailwind CSS | Utility-first CSS with a custom Glassmorphism theme. |
| **State** | React Context API | Global state management for resources and schedules. |
| **Backend** | Firebase Functions | Serverless Node.js environment for secure AI execution. |
| **Database** | Firebase Firestore | Real-time NoSQL database for syncing data. |
| **AI Model** | Google GenAI SDK | Integration with Gemini 3.0 Pro & 2.5 Flash. |
| **Charts** | Recharts | Visual analytics for workload and utilization. |

---

## 🚀 Getting Started

### Prerequisites
*   Node.js v18+
*   A Firebase Project (Firestore, Auth, & Functions enabled)
*   A Google Cloud Project with Gemini API Access

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/aetherschedule.git
    cd aetherschedule
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    cd functions && npm install
    ```

3.  **Environment Setup**
    
    **Frontend:**
    No `.env` is required for the frontend as the API key has been moved to the backend for security. Firebase config is initialized in `services/firebase.ts`.

    **Backend (Firebase Functions):**
    Set your Gemini API key in the Firebase Functions configuration:
    ```bash
    firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

5.  **Deploy Functions**
    To enable the AI features, deploy the backend functions:
    ```bash
    firebase deploy --only functions
    ```

### Building for Production
AetherSchedule is optimized for Vercel or Firebase Hosting.
```bash
npm run build
```

---

## 📂 Project Structure

```text
src/
├── components/
│   ├── datamanagement/     # Modular resource forms & tables
│   ├── Analytics.tsx       # Advanced visualization dashboards
│   ├── Dashboard.tsx       # Health Score & KPIs
│   ├── Layout.tsx          # Responsive Shell & Sidebar
│   ├── Scheduler.tsx       # Main Timetable Grid & Controls
│   ├── Settings.tsx        # System Configuration
│   ├── StudentPortal.tsx   # Public read-only student view
│   └── FacultyPortal.tsx   # Public read-only faculty view
├── context/
│   └── StoreContext.tsx    # Global State & Firestore Logic
├── core/
│   └── TimeUtils.ts        # Time calculation & Timeline generation
├── services/
│   ├── firebase.ts         # DB Initialization
│   └── geminiService.ts    # Frontend bridge to Cloud Functions
└── types.ts                # TypeScript Interfaces (The Truth Source)

functions/
├── index.js                # Secure Backend Logic (AI & DB Writes)
└── package.json            # Backend dependencies
```

---

## 📄 License

This project is licensed under the MIT License.

<div align="center">
  <p>Built with ❤️ by Aether Team</p>
</div>
