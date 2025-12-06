
<div align="center">

  <h1>✨ AetherSchedule</h1>
  <h3>The Intelligent Digital Twin for Academic Operations</h3>
  
  <p>
    <strong>Next-Generation Timetabling • AI-Powered Simulation • Client-Side Architecture</strong>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Gemini-3.0_Pro-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white" />
    <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  </p>

</div>

---

## 🚀 Overview

**AetherSchedule** is a **Digital Twin** of an educational institution. It acts as an expert constraint solver to generate collision-free master schedules using **Google Gemini 3.0 Pro**.

**Note:** This version is architected to run **entirely in the browser** (Client-Side), communicating directly with Google's AI APIs and Firebase Firestore. This allows it to run on the **Firebase Free Tier (Spark Plan)** without needing Cloud Functions.

## ✨ Key Features

### 🧠 AI-Powered Core
*   **Gemini 3.0 Reasoning Engine:** Runs directly in your browser to solve multi-dimensional scheduling constraints.
*   **Conflict-Free Generation:** Generates schedules while validating against Room, Faculty, and Time conflicts.
*   **Natural Language Copilot:** Chat with your scheduler to ask questions or request changes.

### 📅 Advanced Scheduler
*   **Visual Grid:** Interactive glassmorphism timetable.
*   **Real-Time Conflict Detection:** Visual red flags for overlaps.
*   **Multi-Teacher Support:** Assign multiple faculty members to single labs.

### 📊 Analytics & Portals
*   **Operations Dashboard:** Real-time KPIs and Health Scores.
*   **Student/Faculty Portals:** Public read-only views for stakeholders.
*   **Data Management:** Full CRUD for Batches, Rooms, Faculty, and Subjects.

---

## 🚀 Getting Started

### Prerequisites
1.  **Node.js v18+**
2.  **Firebase Project:** Create a project at [console.firebase.google.com](https://console.firebase.google.com). Enable **Firestore** and **Authentication**.
3.  **Gemini API Key:** Get a free key at [aistudio.google.com](https://aistudio.google.com).

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
    API_KEY=AIzaSy...Your_Gemini_Key_Here...
    ```

4.  **Firebase Configuration**
    Update `services/firebase.ts` with your project's configuration keys (found in Project Settings > General > Web App).

5.  **Run Development Server**
    ```bash
    npm run dev
    ```

### Building for Production
```bash
npm run build
```

---

## 📄 License
MIT License.
