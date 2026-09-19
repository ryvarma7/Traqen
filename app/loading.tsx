import { Diamond } from "@/components/loading-ui/diamond";

/* Route loading boundary: Diamond on pure black. app-scene keeps the auth grain/vignette off. */
export default function Loading() {
  return (
    <div className="app-scene flex min-h-screen items-center justify-center">
      <Diamond className="size-10 text-foreground" />
    </div>
  );
}