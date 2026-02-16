"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LookupPage() {
  const [jobNumber, setJobNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/bookings/${jobNumber.trim()}`);
      if (res.status === 404) {
        setError("No booking found with that job number.");
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      router.push(`/lookup/${jobNumber.trim()}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Sprinkler Services
          </Link>
          <Link
            href="/booking"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Book Now
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold">Look Up Your Booking</h1>
          <p className="mb-6 text-gray-600">
            Enter your job number to view or manage your booking.
          </p>

          <form onSubmit={handleLookup} className="space-y-4">
            <Input
              label="Job Number"
              id="jobNumber"
              placeholder="e.g., SB-2026-A3F7 or BF-2026-A3F7"
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value.toUpperCase())}
            />

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Looking up..." : "Find Booking"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
