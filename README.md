
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
    <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
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
*   **Automatic Fallback System:** Seamlessly switches between `Gemini-3-pro-preview` (Reasoning) and `Gemini-2.5-flash` (Speed) to ensure reliability.
*   **Global Conflict Awareness:** The AI "sees" the schedules of all other batches while generating a timetable for a specific batch, preventing double-booking of shared resources.
*   **Smart Optimization Goals:**
    *   **Slot Variance:** Distributes subjects across different times of the day (e.g., Math isn't always at 9 AM).
    *   **Lab Grouping:** Automatically groups "Lab" subjects into consecutive back-to-back slots.
    *   **Fatigue Management:** Avoids scheduling teachers for more than 4 consecutive hours.

### 📅 Advanced Scheduler
*   **Visual Grid:** Interactive, glassmorphism-styled timetable with support for custom time slots and breaks.
*   **Real-Time Conflict Detection:** Instantly flags overlaps (red cells) with detailed tooltips explaining the issue (e.g., *"Room 101 Double Booked"*).
*   **Multi-Teacher Support:** Assign multiple faculty members to a single slot (crucial for Labs/Practicals).
*   **Break Rendering:** Visualizes break times (e.g., Lunch, Recess) directly on the grid.

### 🗂️ Resource Management
*   **Tabbed Interface:** Clean management for Faculty, Departments, Subjects, Rooms, and Batches.
*   **Deep Linking:** 
    *   Assign specific **Teachers** to specific **Subjects** within a **Batch**.
    *   Assign **Fixed Rooms** (Home Rooms) to batches.
*   **Lecture Frequency Control:** Define exactly how many **"Lectures Per Week"** a subject requires, distinct from its credit value.

### ⚙️ System Configuration
*   **Temporal Modeling:** Define College Start Time, End Time, and Class Duration (down to 1-minute precision).
*   **Dynamic Breaks:** Create custom breaks (Lunch, Assembly) that the AI respects during generation.
*   **Working Days:** Toggle active days (Mon-Sat).

### 🛡️ Version Control
*   **Snapshot System:** Save named versions of the timetable (e.g., "Draft 1", "Final V2").
*   **Restoration:** Instantly revert the entire institution's schedule to a previous state.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | High-performance component-based UI. |
| **Language** | TypeScript | Strict typing for robust academic data modeling. |
| **Styling** | Tailwind CSS | Utility-first CSS with a custom Glassmorphism theme. |
| **State** | React Context API | Global state management for resources and schedules. |
| **Database** | Firebase Firestore | Real-time NoSQL database for syncing data. |
| **AI Model** | Google GenAI SDK | Integration with Gemini Reasoning & Flash models. |
| **Charts** | Recharts | Visual analytics for workload and utilization. |
| **Icons** | Lucide React | Clean, consistent iconography. |

---

## 🚀 Getting Started

### Prerequisites
*   Node.js v18+
*   A Firebase Project (Firestore & Auth enabled)
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
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    # Your Google Gemini API Key
    API_KEY=your_gemini_api_key_here
    ```
    *Note: Firebase configuration is currently embedded in `services/firebase.ts`. For production, move these to `.env` variables as well.*

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

### Building for Production
AetherSchedule is optimized for Vercel deployment.
```bash
npm run build
```

---

## 📂 Project Structure

```text
src/
├── components/
│   ├── datamanagement/     # Modular resource forms & tables
│   ├── Dashboard.tsx       # Analytics & Health Score
│   ├── Layout.tsx          # Responsive Shell & Sidebar
│   ├── Scheduler.tsx       # Main Timetable Grid & Controls
│   └── Settings.tsx        # System Configuration
├── context/
│   └── StoreContext.tsx    # Global State & Firestore Logic
├── core/
│   └── TimeUtils.ts        # Time calculation & Timeline generation
├── services/
│   ├── firebase.ts         # DB Initialization
│   └── geminiService.ts    # AI Prompt Engineering & API
└── types.ts                # TypeScript Interfaces (The Truth Source)
```

---

## 🤖 AI Prompt Engineering

The heart of AetherSchedule is the `generateScheduleWithGemini` function. We use a **Chain-of-Thought** style prompt that injects:
1.  **Structure:** Start/End times, Breaks, Slot Indices.
2.  **Constraint Mask:** A "Busy Matrix" of existing schedules from other batches.
3.  **Optimization Rules:** Explicit instructions for *The Lab Problem*, *Teacher Fatigue*, and *Slot Variance*.
4.  **Sanitization:** Data is aggressively sanitized using `WeakSet` to prevent circular reference errors during JSON serialization before reaching the AI.

---

## 📄 License

This project is licensed under the MIT License.

<div align="center">
  <p>Built with ❤️ by Aether Team</p>
</div>
