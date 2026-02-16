"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SERVICE_CONFIGS } from "@/lib/service-config";
import type { ServiceType } from "@/lib/types";

interface BookingDetail {
  jobNumber: string;
  serviceType?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  preferredTime: string;
  status: string;
  notes: string | null;
  zoneName: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AvailableDate {
  id: string;
  date: string;
  timeOfDay: string;
  zoneName: string;
  spotsRemaining: number;
}

export default function BookingDetailPage() {
  const params = useParams();
  const jobNumber = params.jobNumber as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [jobNumber]);

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/bookings/${jobNumber}`);
      if (!res.ok) throw new Error("Booking not found");
      const data = await res.json();
      setBooking(data);

      // If awaiting schedule, fetch available dates
      if (data.status === "AWAITING_SCHEDULE" && data.zoneName) {
        const avRes = await fetch(
          `/api/availability?zoneId=${encodeURIComponent(data.zoneName)}&timeOfDay=${data.preferredTime}`
        );
        if (avRes.ok) {
          const avData = await avRes.json();
          setAvailableDates(avData.dates || []);
        }
      }
    } catch {
      setError("Could not find booking. Please check your job number.");
    } finally {
      setLoading(false);
    }
  };

  const selectDate = async (dateId: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/bookings/${jobNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableDateId: dateId }),
      });
      if (!res.ok) throw new Error("Failed to update booking");
      await fetchBooking();
    } catch {
      setError("Failed to select date. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const cancelBooking = async () => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/bookings/${jobNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error("Failed to cancel booking");
      await fetchBooking();
    } catch {
      setError("Failed to cancel booking. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading booking details...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold text-brand-700">
              Sprinkler Services
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-red-600">{error || "Booking not found"}</p>
          <Link href="/lookup" className="mt-4 inline-block text-brand-600 hover:underline">
            Try another job number
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Sprinkler Services
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Job Number</p>
                <p className="text-xl font-bold">{booking.jobNumber}</p>
              </div>
              <Badge status={booking.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {booking.serviceType && (
              <div>
                <p className="text-sm font-medium text-gray-500">Service</p>
                <p>{SERVICE_CONFIGS[booking.serviceType as ServiceType]?.label || booking.serviceType}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-500">Customer</p>
              <p>{booking.customerName}</p>
              <p className="text-sm text-gray-600">{booking.customerEmail}</p>
              {booking.customerPhone && (
                <p className="text-sm text-gray-600">{booking.customerPhone}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Address</p>
              <p>
                {booking.address}, {booking.city}, {booking.state} {booking.zip}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Preferred Time</p>
              <p>{booking.preferredTime}</p>
            </div>

            {booking.zoneName && (
              <div>
                <p className="text-sm font-medium text-gray-500">Service Zone</p>
                <p>{booking.zoneName}</p>
              </div>
            )}

            {booking.scheduledDate && (
              <div>
                <p className="text-sm font-medium text-gray-500">Scheduled</p>
                <p>
                  {new Date(booking.scheduledDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  - {booking.scheduledTime}
                </p>
              </div>
            )}

            {booking.notes && (
              <div>
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-600">{booking.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available dates selection */}
        {booking.status === "AWAITING_SCHEDULE" && availableDates.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Pick a Date</h2>
              <p className="text-sm text-gray-600">
                Select an available date for your blowout service.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {availableDates.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => selectDate(d.id)}
                    disabled={updating}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(d.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-gray-500">{d.timeOfDay}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {d.spotsRemaining} spots left
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancel option */}
        {!["COMPLETED", "CANCELLED", "IN_PROGRESS"].includes(booking.status) && (
          <div className="mt-6 text-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={cancelBooking}
              disabled={updating}
            >
              Cancel Booking
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
