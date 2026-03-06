# Smart Catering Mobile App 🍲🚀

A fast, modern, and comprehensive comprehensive catering management application built with **React Native (Expo)** and **Supabase**. It provides dedicated interfaces for both individual/corporate customers and administrators, handling everything from daily menus to corporate debt tracking.

## 🌟 Key Features

### For Customers (Individual & Corporate)
- **Daily & Weekly Menus:** Browse the "Menu of the Day" with dynamic availability statuses.
- **Tabldot Packages:** Choose predefined meal packages (2, 3, or 4 options).
- **Cart & Order Management:** Add items to the cart, review the summary, and place orders.
- **Debt & Balance Tracking:** View current debt balances and download detailed PDF statements with timestamps (Daily, Weekly, Monthly filters).
- **Order History:** Access all past orders with detailed breakdowns and receipts.

### For Administrators
- **Menu Management:** Add, edit, or remove menu items and categories. Mark items as "Sold Out".
- **Customer Management:** View and manage user accounts, split by 'Individual' and 'Corporate' lists.
- **Order Tracking:** Approve pending orders, monitor live order statuses.
- **Financial Dashboard:** Track total debts, collect payments (Tahsilat), and generate professional PDF statements for corporate and individual clients.

## 🛠️ Tech Stack

- **Frontend:** React Native, Expo, React Navigation, Expo Router
- **Backend & Database:** Supabase (PostgreSQL, Authentication)
- **State Management:** Zustand
- **Styling:** Custom StyleSheet (Light & Dark Theme Support)
- **Utilities:** Expo Print (PDF Generation), Expo Sharing

## 🚀 Getting Started

### Prerequisites
- Node.js installed
- Expo CLI (`npm install -g expo-cli`)
- A Supabase account and project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/EntropyWorkCo/SmartCatering.git
   cd SmartCatering
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the app:
   ```bash
   npx expo start
   ```

## 👨‍💻 Developed By

This project was passionately developed by:
- **Ayşe Şevval Malkoç**
- **Sena Tuncer**

## 📄 License
This project is for educational and portfolio purposes. Feel free to explore the code!
