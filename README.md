# Smart Catering Management System 🍲🚀

This project is an **Internship Project** developed at **Entropy Work Co.** The system consists of a mobile application for customers and a comprehensive web panel for business management.

## 🏗️ Project Structure

The project is divided into two main components:
1.  **Web Admin Panel (`catering-admin-web`):** A comprehensive management interface for administrators and business owners, featuring menu management, customer tracking, and financial reporting.
2.  **Mobile Application (Root):** An application for individual and corporate customers to view daily menus, place orders, and track their debts.

---

## 🚀 Installation and Setup

### 1. Web Admin Panel (Vite + React)
To set up the management panel:
```bash
cd catering-admin-web
npm install
npm run dev
```
*   **Access:** Open `http://localhost:5173` in your browser.
*   **Configuration:** Supabase connection details are defined in `src/lib/supabase.ts`. SMS services use the keys provided in the `.env` file.

### 2. Mobile Application (React Native + Expo)
To set up the customer application:
```bash
# Ensure you are in the root directory
npm install
npx expo start
```
*   **Configuration:** You must create a `.env` file in the root directory and add the following credentials:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

---

## 🛠️ Tech Stack

- **Frontend:** React Native (Expo), React (Vite)
- **Backend & Database:** Supabase (PostgreSQL, Auth)
- **State Management:** Zustand
- **Reporting:** Expo Print & html2pdf.js (PDF Generation)

## 👨‍💻 Developers
Developed as part of the **Entropy Work Co.** internship program:
- **Ayşe Şevval Malkoç**
- **Sena Tuncer**

---

## 📄 License
This project is currently under development and was produced as an internship project within Entropy Work Co.
