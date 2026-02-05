"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { bookingSchema, type BookingInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const timeOptions = [
  { value: "MORNING", label: "Morning (8 AM - 12 PM)" },
  { value: "AFTERNOON", label: "Afternoon (12 PM - 4 PM)" },
  { value: "EVENING", label: "Evening (4 PM - 7 PM)" },
];

const steps = ["Contact Info", "Address", "Preferences"];

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      state: "CO",
      preferredTime: "MORNING",
    },
  });

  const nextStep = async () => {
    const fieldsToValidate: (keyof BookingInput)[][] = [
      ["customerName", "customerEmail", "customerPhone"],
      ["address", "city", "state", "zip"],
      ["preferredTime"],
    ];

    const valid = await trigger(fieldsToValidate[step]);
    if (valid) setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const onSubmit = async (data: BookingInput) => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create booking");
      }

      const result = await res.json();
      router.push(`/booking/confirmation?jobNumber=${result.jobNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i <= step
                  ? "bg-brand-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                i <= step ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="mx-4 h-px w-8 bg-gray-300" />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: Contact Info */}
        {step === 0 && (
          <div className="space-y-4">
            <Input
              label="Full Name"
              id="customerName"
              placeholder="John Smith"
              error={errors.customerName?.message}
              {...register("customerName")}
            />
            <Input
              label="Email"
              id="customerEmail"
              type="email"
              placeholder="john@example.com"
              error={errors.customerEmail?.message}
              {...register("customerEmail")}
            />
            <Input
              label="Phone (optional)"
              id="customerPhone"
              type="tel"
              placeholder="(303) 555-1234"
              error={errors.customerPhone?.message}
              {...register("customerPhone")}
            />
          </div>
        )}

        {/* Step 2: Address */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Street Address"
              id="address"
              placeholder="123 Main St"
              error={errors.address?.message}
              {...register("address")}
            />
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-3">
                <Input
                  label="City"
                  id="city"
                  placeholder="Denver"
                  error={errors.city?.message}
                  {...register("city")}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="State"
                  id="state"
                  placeholder="CO"
                  maxLength={2}
                  error={errors.state?.message}
                  {...register("state")}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label="ZIP Code"
                  id="zip"
                  placeholder="80202"
                  error={errors.zip?.message}
                  {...register("zip")}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 2 && (
          <div className="space-y-4">
            <Select
              label="Preferred Time of Day"
              id="preferredTime"
              options={timeOptions}
              error={errors.preferredTime?.message}
              {...register("preferredTime")}
            />
            <div className="space-y-1">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Gate code, special instructions, etc."
                {...register("notes")}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < steps.length - 1 ? (
            <Button type="button" onClick={nextStep}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Book Now"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
