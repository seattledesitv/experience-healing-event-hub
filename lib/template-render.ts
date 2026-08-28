export type TemplateValues = {
  event_title?: string;
  start_at?: string;
  end_at?: string;
  venue?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  registration_url?: string;
  instagram_handle?: string;
};

function ordinal(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function parseLocal(value?: string) {
  return value ? new Date(value) : null;
}

function formatEventDate(value?: string) {
  const date = parseLocal(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
  return `${weekday}, ${month} ${ordinal(date.getDate())}`;
}

function formatTime(value?: string) {
  const date = parseLocal(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function buildTemplateVariables(values: TemplateValues) {
  const start = parseLocal(values.start_at);
  const month = start && !Number.isNaN(start.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "long" }).format(start) : "";
  const year = start && !Number.isNaN(start.getTime()) ? String(start.getFullYear()) : "";
  const startTime = formatTime(values.start_at);
  const endTime = formatTime(values.end_at);

  return {
    event_title: values.event_title || "",
    event_date: formatEventDate(values.start_at),
    event_time: startTime && endTime ? `${startTime} - ${endTime}` : startTime,
    venue: values.venue || "",
    city: values.city || "",
    state: values.state || "",
    postal_code: values.postal_code || "",
    registration_url: values.registration_url || "",
    month,
    month_lower: month.toLowerCase(),
    year,
    instagram_handle: values.instagram_handle || "@srimanjuexphealing",
  };
}

export function renderTemplate(text: string | null | undefined, values: TemplateValues) {
  if (!text) return "";
  const variables = buildTemplateVariables(values);
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key as keyof typeof variables] : match;
  });
}

export function unresolvedPlaceholders(text: string) {
  return Array.from(new Set(text.match(/{{\s*[a-zA-Z0-9_]+\s*}}/g) || []));
}

export const supportedTemplatePlaceholders = [
  "{{event_title}}",
  "{{event_date}}",
  "{{event_time}}",
  "{{venue}}",
  "{{city}}",
  "{{state}}",
  "{{postal_code}}",
  "{{registration_url}}",
  "{{month}}",
  "{{month_lower}}",
  "{{year}}",
  "{{instagram_handle}}",
];
