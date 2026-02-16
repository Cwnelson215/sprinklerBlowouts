import { ServiceType } from "./types";

export interface ServiceConfig {
  label: string;
  shortLabel: string;
  jobPrefix: string;
  description: string;
  bookingHeading: string;
  bookingSubheading: string;
  email: {
    serviceName: string;
    confirmationBody: string;
    reminderSubject: string;
    reminderHeading: string;
    reminderBody: string;
    cancellationBody: string;
  };
}

export const SERVICE_CONFIGS: Record<ServiceType, ServiceConfig> = {
  SPRINKLER_BLOWOUT: {
    label: "Sprinkler Blowout",
    shortLabel: "Blowout",
    jobPrefix: "SB",
    description:
      "Protect your irrigation system from freeze damage. We use compressed air to blow out all remaining water from your sprinkler lines, heads, and valves.",
    bookingHeading: "Schedule Your Blowout",
    bookingSubheading: "Fill out the form below and we'll get you scheduled.",
    email: {
      serviceName: "Sprinkler Blowout Service",
      confirmationBody: "Your sprinkler blowout has been booked.",
      reminderSubject: "Reminder: Sprinkler Blowout Tomorrow",
      reminderHeading: "Your Blowout is Tomorrow!",
      reminderBody:
        "This is a reminder that your sprinkler blowout is scheduled for tomorrow. Please ensure access to your sprinkler system and shut off the water supply before our arrival.",
      cancellationBody: "Your sprinkler blowout booking has been cancelled.",
    },
  },
  BACKFLOW_TESTING: {
    label: "Backflow Prevention Testing",
    shortLabel: "Backflow Test",
    jobPrefix: "BF",
    description:
      "Annual backflow preventer testing to keep your water supply safe and compliant with local regulations.",
    bookingHeading: "Schedule Your Backflow Test",
    bookingSubheading:
      "Fill out the form below to schedule your annual backflow prevention test.",
    email: {
      serviceName: "Backflow Prevention Testing",
      confirmationBody: "Your backflow prevention test has been booked.",
      reminderSubject: "Reminder: Backflow Test Tomorrow",
      reminderHeading: "Your Backflow Test is Tomorrow!",
      reminderBody:
        "This is a reminder that your backflow prevention test is scheduled for tomorrow. Please ensure access to your backflow preventer device.",
      cancellationBody:
        "Your backflow prevention testing booking has been cancelled.",
    },
  },
};

export function getServiceConfig(serviceType: ServiceType): ServiceConfig {
  return SERVICE_CONFIGS[serviceType];
}

export const SERVICE_TYPE_OPTIONS = Object.entries(SERVICE_CONFIGS).map(
  ([value, config]) => ({
    value: value as ServiceType,
    label: config.label,
  })
);
