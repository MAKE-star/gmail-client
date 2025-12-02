import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Trash2,
  Zap,
  Mail,
  LogOut,
  RefreshCw,
  AlertCircle,
  Info,
} from "lucide-react";
import io from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function GmailBulkDelete() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState("stats");
  const [socket, setSocket] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState({});
  const [activeDeletes, setActiveDeletes] = useState(new Set());
  const [userCount, setUserCount] = useState(0);

  // Check for authentication on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("authenticated") === "true") {
      window.history.replaceState({}, "", "/");
      checkAuthAndLoadStats();
    } else {
      checkAuthAndLoadStats();
    }
  }, []);

  // Initialize Socket.IO
  useEffect(() => {
    if (isAuthenticated) {
      const newSocket = io(API_BASE_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      newSocket.on("connect", () => {
        console.log("Socket connected:", newSocket.id);
      });

      newSocket.on("progress", (data) => {
        setDeleteProgress((prev) => ({
          ...prev,
          [data.category]: { deleted: data.deleted, status: "deleting" },
        }));
      });

      newSocket.on("complete", (data) => {
        setDeleteProgress((prev) => ({
          ...prev,
          [data.category]: { deleted: data.totalDeleted, status: "complete" },
        }));
        setActiveDeletes((prev) => {
          const next = new Set(prev);
          next.delete(data.category);
          return next;
        });
        setTimeout(() => loadStats(), 1000);
      });

      newSocket.on("error", (data) => {
        alert(`Error: ${data.message}`);
        setActiveDeletes((prev) => {
          const next = new Set(prev);
          next.delete(data.category);
          return next;
        });
      });

      setSocket(newSocket);

      return () => newSocket.close();
    }
  }, [isAuthenticated]);

  const checkAuthAndLoadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Stats received:", data);
        setIsAuthenticated(true);
        setUserEmail(data.profile?.emailAddress || "Unknown");
        setStats(data.stats);
      } else {
        console.error("Stats response not OK:", response.status);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadUserCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-count`);
      if (response.ok) {
        const data = await response.json();
        setUserCount(data.count);
      }
    } catch (error) {
      console.error("Failed to load user count:", error);
    }
  };

  useEffect(() => {
    loadUserCount();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/gmail`;
  };

  const handleDelete = async (category) => {
    if (!socket || !socket.connected) {
      alert("Socket not connected. Please refresh the page.");
      return;
    }

    if (activeDeletes.has(category)) {
      alert("Delete already in progress for this category");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete all emails in category: ${category}?\n\nThis will move them to trash.`
      )
    ) {
      return;
    }

    setActiveDeletes((prev) => new Set(prev).add(category));
    setDeleteProgress((prev) => ({
      ...prev,
      [category]: { deleted: 0, status: "starting" },
    }));

    socket.emit("delete-all", { category });
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
      setIsAuthenticated(false);
      setUserEmail("");
      setStats(null);
      if (socket) socket.close();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getCategoryData = () => {
    if (!stats) return [];

    if (Array.isArray(stats)) {
      return stats;
    }

    if (stats.categories && Array.isArray(stats.categories)) {
      return stats.categories;
    }

    if (stats.categories && typeof stats.categories === "object") {
      return Object.entries(stats.categories).map(([label, data]) => ({
        label,
        count: data.count || data,
        percentage: data.percentage || 0,
      }));
    }

    return [];
  };

  const totalMessages = stats?.total || stats?.totalMessages || 0;
  const categories = getCategoryData();
  const deletablePercentage =
    stats?.deletablePercentage ||
    (categories.length > 0
      ? (categories.reduce((sum, cat) => sum + (cat.count || 0), 0) /
          totalMessages) *
        100
      : 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Gmail Bulk Delete
            </h1>
            <p className="text-gray-600">
              Manage and clean up your Gmail inbox efficiently
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Mail className="w-5 h-5" />
            {loading ? "Checking..." : "Sign in with Gmail"}
          </button>

          <p className="text-xs text-gray-500 mt-4 text-center">
            This app will request permission to manage your Gmail messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Gmail Bulk Delete
                </h1>
                <p className="text-sm text-gray-600">{userEmail}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadStats}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Socket Connection Status */}
        {socket && !socket.connected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800">
              Real-time connection lost. Reconnecting...
            </p>
          </div>
        )}

        {/* Statistics Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 font-medium">Total Emails</h3>
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {totalMessages.toLocaleString()}
              </p>
              {stats.note && (
                <p className="text-xs text-gray-500 mt-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Category counts are estimates
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 font-medium">Categories</h3>
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {categories.length}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 font-medium">Deletable</h3>
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {deletablePercentage
                  ? `${deletablePercentage.toFixed(1)}%`
                  : "N/A"}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setDeleteMode("stats")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                deleteMode === "stats"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <BarChart3 className="w-5 h-5 inline mr-2" />
              View Statistics
            </button>
            <button
              onClick={() => setDeleteMode("delete")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                deleteMode === "delete"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Trash2 className="w-5 h-5 inline mr-2" />
              Delete by Category
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : deleteMode === "stats" && categories.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Email Distribution by Category
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Category counts (~201) are estimates
                  due to Gmail API limitations. The actual deletion will process
                  all emails in the selected category, not just the displayed
                  count.
                </p>
              </div>
              <div className="space-y-3">
                {categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">
                        {cat.label}
                      </span>
                      <span className="text-sm text-gray-600">
                        ~{cat.count.toLocaleString()} emails
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${cat.percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {cat.percentage.toFixed(1)}% of total
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : deleteMode === "delete" && categories.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Delete Messages by Category
              </h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Deletion will process{" "}
                  <strong>all emails</strong> in the category, not just the ~201
                  shown. The count is a Gmail API estimate limitation.
                </p>
              </div>
              <div className="space-y-2">
                {categories.map((cat, idx) => {
                  const isDeleting = activeDeletes.has(cat.label);
                  const progress = deleteProgress[cat.label];
                  // Check if this is the trash category
                  const isTrashRow = cat.label === "trash";

                  return (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-800">
                              {cat.label}
                            </span>
                            <span className="text-sm text-gray-600">
                              ~{cat.count.toLocaleString()} emails
                            </span>
                          </div>

                          {/* Trash Warning Message */}
                          {isTrashRow && (
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2 flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-blue-800">
                                <strong>Tip:</strong> Review your trash folder
                                first, then use Gmail's "Empty Trash now" button
                                for permanent deletion. Items in trash are
                                automatically deleted after 30 days.
                              </p>
                            </div>
                          )}

                          {isDeleting && progress && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>
                                  {progress.status === "starting"
                                    ? "Starting..."
                                    : "Deleting..."}
                                </span>
                                <span>
                                  {progress.deleted.toLocaleString()} deleted
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-red-600 h-1.5 rounded-full transition-all animate-pulse"
                                  style={{
                                    width: `${Math.min(
                                      (progress.deleted / cat.count) * 100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(cat.label)}
                          disabled={
                            cat.label === "trash" ||
                            isDeleting ||
                            !socket ||
                            !socket.connected
                          }
                          className={`ml-4 px-4 py-2 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                            cat.label === "trash"
                              ? "bg-gray-300 text-gray-500"
                              : "bg-red-600 hover:bg-red-700 text-white"
                          }`}
                          title={
                            cat.label === "trash"
                              ? "Use Gmail's 'Empty Trash now' button instead"
                              : ""
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                          {cat.label === "trash"
                            ? "Disabled"
                            : isDeleting
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No data available. Click refresh to load stats.
            </div>
          )}
        </div>
        <div className="mt-6 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            <span>
              <strong className="text-indigo-600">
                {userCount.toLocaleString()}
              </strong>
              <span className="ml-1">
                {userCount === 1 ? "user has" : "users have"} used this app
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
