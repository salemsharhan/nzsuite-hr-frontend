# The System - Enterprise HR Management System

A modern, enterprise-grade HR Management System built with React, Vite, Tailwind CSS, and Supabase. Designed with a "Neo-Corporate Glass" aesthetic, full RTL support, and system-controlled automation logic.

![Dashboard Preview](client/public/images/dashboard-hero.jpg)

## 🚀 Features

*   **Core HR:** Employee Master Profile, Department Management, Document Filing.
*   **Attendance:** System-controlled punch logs, regularization workflows, and shift management.
*   **Payroll:** Automated salary processing, cycle management, and approval chains.
*   **Recruitment:** Kanban-style candidate pipeline tracking.
*   **Self-Service (ESS):** Employee portal for leave requests, payslips, and profile updates.
*   **Analytics:** Real-time dashboards for headcount, attrition, and costs.
*   **Localization:** Native **Arabic (RTL)** and English (LTR) support with dynamic font switching (Cairo/Manrope).
*   **Tech Stack:** React 18, Vite, Tailwind CSS, Supabase, Recharts, Lucide Icons.

## 🛠️ Setup Instructions

### 1. Prerequisites
*   Node.js v18+
*   pnpm (recommended) or npm
*   A Supabase project

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/the-system-hr-frontend.git

# Navigate to the project
cd the-system-hr-frontend

# Install dependencies
pnpm install
```

### 3. Database Setup
1.  Create a new project on [Supabase](https://supabase.com).
2.  Copy your **Project URL** and **Anon Key**.
3.  Rename `.env.example` to `.env` and paste your keys:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```
4.  **Run the Schema:**
    *   Start the application (`pnpm dev`).
    *   Navigate to `http://localhost:3000/setup`.
    *   Copy the SQL code displayed.
    *   Paste it into your Supabase Dashboard's **SQL Editor** and run it.

### 4. Running the App
```bash
pnpm dev
```
Open `http://localhost:3000` in your browser.

## 📂 Project Structure

```
src/
├── components/         # Reusable UI components (Cards, Modals, Buttons)
├── context/            # Global state (Language, Auth)
├── data/               # Static data and translation files (locales)
├── pages/              # Application screens (Dashboard, Employees, etc.)
├── services/           # API integration (Supabase, Mock Fallback)
└── utils/              # Helper functions (i18n, formatting)
```

## 🎨 Design System

*   **Theme:** Neo-Corporate Glass (Dark Mode default)
*   **Fonts:**
    *   English: Manrope (Headings), Inter (Body)
    *   Arabic: Cairo (All text)
*   **Colors:** Deep Slate Backgrounds, Electric Blue Accents, Frosted Glass Cards.

## 🤝 Contributing

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Proprietary Software. All rights reserved.
