import { ServiceType } from "../types";
import { getServiceConfig } from "../service-config";

interface BookingInfo {
  jobNumber: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  date?: string;
  timeOfDay?: string;
  serviceType?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://blowouts.example.com";

function layout(content: string, serviceName?: string): string {
  const name = serviceName || "Sprinkler Services";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #15803d; font-size: 24px; margin: 0;">${name}</h1>
  </div>
  ${content}
  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #6b7280;">
    <p>${name}</p>
  </div>
</body>
</html>`;
}

function getEmailConfig(booking: BookingInfo) {
  const serviceType = (booking.serviceType || "SPRINKLER_BLOWOUT") as ServiceType;
  return getServiceConfig(serviceType);
}

export function confirmationEmail(booking: BookingInfo): { subject: string; html: string } {
  const config = getEmailConfig(booking);
  return {
    subject: `Booking Confirmed - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #15803d;">Booking Confirmed!</h2>
      <p>Hi ${booking.customerName},</p>
      <p>${config.email.confirmationBody} Here are your details:</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Service:</strong> ${config.label}</p>
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
        ${booking.date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${booking.date}</p>` : ""}
        ${booking.timeOfDay ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${booking.timeOfDay}</p>` : ""}
      </div>
      <p>You can check or update your booking anytime:</p>
      <a href="${baseUrl}/lookup/${booking.jobNumber}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking</a>
    `, config.email.serviceName),
  };
}

export function reminderEmail(booking: BookingInfo): { subject: string; html: string } {
  const config = getEmailConfig(booking);
  return {
    subject: `${config.email.reminderSubject} - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #15803d;">${config.email.reminderHeading}</h2>
      <p>Hi ${booking.customerName},</p>
      <p>${config.email.reminderBody}</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Service:</strong> ${config.label}</p>
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
        ${booking.date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${booking.date}</p>` : ""}
        ${booking.timeOfDay ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${booking.timeOfDay}</p>` : ""}
      </div>
      <a href="${baseUrl}/lookup/${booking.jobNumber}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking</a>
    `, config.email.serviceName),
  };
}

export function updateEmail(booking: BookingInfo, updateDescription: string): { subject: string; html: string } {
  const config = getEmailConfig(booking);
  return {
    subject: `Booking Updated - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #15803d;">Booking Updated</h2>
      <p>Hi ${booking.customerName},</p>
      <p>Your booking has been updated: ${updateDescription}</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Service:</strong> ${config.label}</p>
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
        ${booking.date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${booking.date}</p>` : ""}
        ${booking.timeOfDay ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${booking.timeOfDay}</p>` : ""}
      </div>
      <a href="${baseUrl}/lookup/${booking.jobNumber}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking</a>
    `, config.email.serviceName),
  };
}

export function cancellationEmail(booking: BookingInfo): { subject: string; html: string } {
  const config = getEmailConfig(booking);
  return {
    subject: `Booking Cancelled - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #dc2626;">Booking Cancelled</h2>
      <p>Hi ${booking.customerName},</p>
      <p>${config.email.cancellationBody}</p>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Service:</strong> ${config.label}</p>
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
      </div>
      <p>If this was a mistake, you can submit a new booking:</p>
      <a href="${baseUrl}/booking" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Book Again</a>
    `, config.email.serviceName),
  };
}
