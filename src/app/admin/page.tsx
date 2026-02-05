"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalBookings: number;
  pendingBookings: number;
  scheduledBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  activeZones: number;
  upcomingDates: number;
}

interface RecentBooking {
  jobNumber: string;
  customerName: string;
  status: string;
  createdAt: string;
  zone: { name: string } | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      const data = await res.json();
      setStats(data.stats);
      setRecentBookings(data.recentBookings);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading dashboard...</p>;
  }

  if (!stats) {
    return <p className="text-red-600">Failed to load dashboard.</p>;
  }

  const statCards = [
    { label: "Total Bookings", value: stats.totalBookings },
    { label: "Pending", value: stats.pendingBookings },
    { label: "Scheduled", value: stats.scheduledBookings },
    { label: "Completed", value: stats.completedBookings },
    { label: "Cancelled", value: stats.cancelledBookings },
    { label: "Active Zones", value: stats.activeZones },
    { label: "Upcoming Dates", value: stats.upcomingDates },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Recent Bookings</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Job #</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Zone</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.jobNumber} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{b.jobNumber}</td>
                    <td className="py-2 pr-4">{b.customerName}</td>
                    <td className="py-2 pr-4">{b.zone?.name || "-"}</td>
                    <td className="py-2 pr-4">
                      <Badge status={b.status} />
                    </td>
                    <td className="py-2 text-gray-500">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recentBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-400">
                      No bookings yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
