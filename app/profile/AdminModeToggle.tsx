"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminModeToggle() {
  const [isAdminMode, setIsAdminMode] = useState(false);

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Admin controls</h2>
        <button
          type="button"
          onClick={() => setIsAdminMode((currentMode) => !currentMode)}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            isAdminMode
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {isAdminMode ? "Admin Mode On" : "Admin Mode"}
        </button>
      </div>

      {isAdminMode ? (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm text-zinc-700">
            Moderate cafes by hiding/unhiding or removing entries from public listings.
          </p>
          <Link
            href="/admin"
            className="mt-2 inline-block rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            Open admin panel
          </Link>
        </div>
      ) : null}
    </section>
  );
}
