import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/admin.functions", () => ({ listTeam: vi.fn(), grantRole: vi.fn(), revokeRole: vi.fn() }));

import { TeamTab } from "@/components/admin/TeamTab";

describe("Team tab", () => {
  it("never offers to remove an admin, and shows no stray code", () => {
    const qc = new QueryClient();
    qc.setQueryData(["team"], [
      { userId: "1", role: "admin", email: "boss@x.test" },
      { userId: "2", role: "editor", email: "ed@x.test" },
    ]);
    const html = renderToStaticMarkup(<QueryClientProvider client={qc}><TeamTab /></QueryClientProvider>);
    expect(html).toContain("Protected");
    expect(html).not.toContain("Remove admin from boss@x.test");
    expect(html).toContain("Remove editor from ed@x.test");
    expect(html).not.toContain('m.role ===');
  });
});
