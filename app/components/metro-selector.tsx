"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const metroOptions = ["All", "LA", "OC", "Bay Area", "Seattle", "NYC"];

export default function MetroSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const metro = searchParams.get("metro") || "All";

  function handleChange(nextMetro: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextMetro === "All") {
      params.delete("metro");
    } else {
      params.set("metro", nextMetro);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      Metro
      <select
        aria-label="Select metro area"
        value={metro}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-sm"
      >
        {metroOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
