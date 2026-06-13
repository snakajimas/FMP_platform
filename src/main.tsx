import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import App from "./App";
import ChatPage from "./pages/ChatPage";
import ScreenerPage from "./pages/ScreenerPage";
import ChartPage from "./pages/ChartPage";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: "chat", element: <ChatPage /> },
      { path: "screener", element: <ScreenerPage /> },
      { path: "chart", element: <ChartPage /> },
      { path: "*", element: <Navigate to="/chat" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
