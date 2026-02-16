"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SERVICE_CONFIGS } from "@/lib/service-config";
import type { ServiceType } from "@/lib/types";

interface Booking {
  id: string;
  jobNumber: string;
  serviceType?: string;
  customerName: string;
  customerEmail: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  preferredTime: string;
  status: string;
  createdAt: string;
  zone: { name: string } | null;
  availableDate: { date: string; timeOfDay: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "AWAITING_SCHEDULE", label: "Awaiting Schedule" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const updateStatusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "AWAITING_SCHEDULE", label: "Awaiting Schedule" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBookings();
  }, [page, statusFilter, serviceTypeFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (serviceTypeFilter) params.set("serviceType", serviceTypeFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/bookings?${params}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setBookings(data.bookings);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBookings();
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) fetchBookings();
    } catch (err) {
      console.error("Error updating booking:", err);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bookings</h1>

      <Card>
        <CardHeader>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, job # or address"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            />
            <Select
              options={[
                { value: "", label: "All Services" },
                { value: "SPRINKLER_BLOWOUT", label: "Blowout" },
                { value: "BACKFLOW_TESTING", label: "Backflow" },
              ]}
              value={serviceTypeFilter}
              onChange={(e) => {
                setServiceTypeFilter(e.target.value);
                setPage(1);
              }}
            />
            <Button type="submit">Search</Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Job #</th>
                      <th className="pb-2 pr-4">Service</th>
                      <th className="pb-2 pr-4">Customer</th>
                      <th className="pb-2 pr-4">Address</th>
                      <th className="pb-2 pr-4">Zone</th>
                      <th className="pb-2 pr-4">Scheduled</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{b.jobNumber}</td>
                        <td className="py-2 pr-4 text-xs">
                          {b.serviceType ? (SERVICE_CONFIGS[b.serviceType as ServiceType]?.shortLabel || b.serviceType) : "-"}
                        </td>
                        <td className="py-2 pr-4">
                          <div>{b.customerName}</div>
                          <div className="text-xs text-gray-400">{b.customerEmail}</div>
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {b.address}, {b.city}
                        </td>
                        <td className="py-2 pr-4">{b.zone?.name || "-"}</td>
                        <td className="py-2 pr-4 text-xs">
                          {b.availableDate
                            ? `${new Date(b.availableDate.date).toLocaleDateString("en-US", { timeZone: "UTC" })} ${b.availableDate.timeOfDay}`
                            : "-"}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge status={b.status} />
                        </td>
                        <td className="py-2">
                          <Select
                            options={updateStatusOptions}
                            value={b.status}
                            onChange={(e) => updateStatus(b.id, e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-gray-400">
                          No bookings found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
