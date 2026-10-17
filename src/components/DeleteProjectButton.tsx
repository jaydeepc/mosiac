"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash } from "./Icons";

export function DeleteProjectButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label="Delete this Mosaic"
      disabled={busy}
      className="btn-ghost p-1.5 rounded-full hover:bg-soft"
      onClick={async () => {
        if (!confirm("Delete this Mosaic? This cannot be undone.")) return;
        setBusy(true);
        await fetch(`/api/projects/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      <Trash size={15} />
    </button>
  );
}
