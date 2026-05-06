export function getScoreBadge(score) {
  const s = Number(score ?? 0);
  if (s === 100) {
    return { label: "Master", tone: "purple" };
  }
  if (s >= 90) {
    return { label: "Expert", tone: "indigo" };
  }
  if (s >= 80) {
    return { label: "Skilled", tone: "blue" };
  }
  if (s >= 70) {
    return { label: "Verified", tone: "emerald" };
  }
  return { label: "Failed", tone: "rose" };
}

export function badgeClassName(tone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "blue":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "indigo":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "purple":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "rose":
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

