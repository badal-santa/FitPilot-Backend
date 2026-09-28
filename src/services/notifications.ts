// OneSignal app that the FitPilot mobile app registers devices with.
export const ONESIGNAL_APP_ID = "fffa4f33-7b70-4d8b-935c-0686d69762df";

// Subset of the OneSignal "create notification" response we rely on.
export type OneSignalResponse = {
  id?: string;
  external_id?: string | null;
  errors?: unknown;
};

export async function sendOneSignalNotification(
  apiKey: string,
  appId: string,
  externalUserId: string,
  title: string,
  message: string,
) {
  const response = await fetch(
    "https://api.onesignal.com/notifications",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,

        include_aliases: {
          external_id: [externalUserId],
        },

        target_channel: "push",

        headings: {
          en: title,
        },

        contents: {
          en: message,
        },
      }),
    },
  );

  const data = (await response.json()) as OneSignalResponse;

  if (!response.ok) {
    console.error("OneSignal API error:", data);
    throw new Error("Failed to send OneSignal notification");
  }

  return data;
}


export async function sendOneSignalBroadcast(
  apiKey: string,
  appId: string,
  title: string,
  message: string,
) {
  const response = await fetch(
    "https://api.onesignal.com/notifications",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,

        included_segments: ["All"],

        target_channel: "push",

        headings: {
          en: title,
        },

        contents: {
          en: message,
        },
      }),
    },
  );

  const data = (await response.json()) as OneSignalResponse;

  if (!response.ok) {
    console.error("OneSignal broadcast error:", data);
    throw new Error("Failed to send broadcast notification");
  }

  return data;
}