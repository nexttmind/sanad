import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/request")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
