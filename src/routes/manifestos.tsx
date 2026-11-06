import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/manifestos")({
  component: ManifestosLayout,
});

function ManifestosLayout() {
  return <Outlet />;
}