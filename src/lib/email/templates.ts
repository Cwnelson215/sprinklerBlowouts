interface BookingInfo {
  jobNumber: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  date?: string;
  timeOfDay?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://blowouts.example.com";

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #15803d; font-size: 24px; margin: 0;">Sprinkler Blowout Service</h1>
  </div>
  ${content}
  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #6b7280;">
    <p>Sprinkler Blowout Service</p>
  </div>
</body>
</html>`;
}

export function confirmationEmail(booking: BookingInfo): { subject: string; html: string } {
  return {
    subject: `Booking Confirmed - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #15803d;">Booking Confirmed!</h2>
      <p>Hi ${booking.customerName},</p>
      <p>Your sprinkler blowout has been booked. Here are your details:</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
        ${booking.date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${booking.date}</p>` : ""}
        ${booking.timeOfDay ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${booking.timeOfDay}</p>` : ""}
      </div>
      <p>You can check or update your booking anytime:</p>
      <a href="${baseUrl}/lookup/${booking.jobNumber}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking</a>
    `),
  };
}

export function reminderEmail(booking: BookingInfo): { subject: string; html: string } {
  return {
    subject: `Reminder: Sprinkler Blowout Tomorrow - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #15803d;">Your Blowout is Tomorrow!</h2>
      <p>Hi ${booking.customerName},</p>
      <p>This is a reminder that your sprinkler blowout is scheduled for tomorrow.</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
        ${booking.date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${booking.date}</p>` : ""}
        ${booking.timeOfDay ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${booking.timeOfDay}</p>` : ""}
      </div>
      <p>Please ensure access to your sprinkler system and shut off the water supply before our arrival.</p>
      <a href="${baseUrl}/lookup/${booking.jobNumber}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking</a>
    `),
  };
}

export function updateEmail(booking: BookingInfo, updateDescription: string): { subject: string; html: string } {
  return {
    subject: `Booking Updated - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #15803d;">Booking Updated</h2>
      <p>Hi ${booking.customerName},</p>
      <p>Your booking has been updated: ${updateDescription}</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
        ${booking.date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${booking.date}</p>` : ""}
        ${booking.timeOfDay ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${booking.timeOfDay}</p>` : ""}
      </div>
      <a href="${baseUrl}/lookup/${booking.jobNumber}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking</a>
    `),
  };
}

export function cancellationEmail(booking: BookingInfo): { subject: string; html: string } {
  return {
    subject: `Booking Cancelled - ${booking.jobNumber}`,
    html: layout(`
      <h2 style="color: #dc2626;">Booking Cancelled</h2>
      <p>Hi ${booking.customerName},</p>
      <p>Your sprinkler blowout booking has been cancelled.</p>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Job Number:</strong> ${booking.jobNumber}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}</p>
      </div>
      <p>If this was a mistake, you can submit a new booking:</p>
      <a href="${baseUrl}/booking" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Book Again</a>
    `),
  };
}
