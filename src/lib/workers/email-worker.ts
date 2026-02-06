import { prisma } from "../prisma";
import { sendEmail } from "../email/ses";
import {
  confirmationEmail,
  reminderEmail,
  updateEmail,
  cancellationEmail,
} from "../email/templates";
import { scheduleJob, JOBS } from "../queue";
import { EmailType } from "@prisma/client";

interface SendEmailData {
  bookingId: string;
  emailType: EmailType;
  updateDescription?: string;
}

interface SendRemindersData {
  recurring?: boolean;
  cron?: string;
  timezone?: string;
}

export async function handleSendEmail(data: SendEmailData) {
  const { bookingId, emailType, updateDescription } = data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { availableDate: true },
  });

  if (!booking) {
    console.error(`Booking ${bookingId} not found for email`);
    return;
  }

  const info = {
    jobNumber: booking.jobNumber,
    customerName: booking.customerName,
    address: booking.address,
    city: booking.city,
    state: booking.state,
    zip: booking.zip,
    date: booking.availableDate
      ? booking.availableDate.date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : undefined,
    timeOfDay: booking.availableDate?.timeOfDay,
  };

  let email: { subject: string; html: string };

  switch (emailType) {
    case "CONFIRMATION":
      email = confirmationEmail(info);
      break;
    case "REMINDER":
      email = reminderEmail(info);
      break;
    case "UPDATE":
      email = updateEmail(info, updateDescription || "Your booking details have been updated.");
      break;
    case "CANCELLATION":
      email = cancellationEmail(info);
      break;
    default:
      console.error(`Unknown email type: ${emailType}`);
      return;
  }

  await sendEmail({
    to: booking.customerEmail,
    subject: email.subject,
    html: email.html,
    bookingId: booking.id,
    emailType,
  });
}

export async function handleSendReminders(_data: SendRemindersData) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      availableDate: {
        date: { gte: tomorrow, lt: dayAfter },
      },
    },
    include: { availableDate: true },
  });

  for (const booking of bookings) {
    // Check if reminder already sent
    const existingReminder = await prisma.emailLog.findFirst({
      where: {
        bookingId: booking.id,
        emailType: "REMINDER",
        sentAt: { gte: tomorrow },
      },
    });

    if (!existingReminder) {
      await scheduleJob(JOBS.SEND_EMAIL, {
        bookingId: booking.id,
        emailType: "REMINDER" as EmailType,
      });
    }
  }

  console.log(`Queued reminders for ${bookings.length} bookings`);
}
