import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/admin.functions";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { AdsTab } from "@/components/admin/AdsTab";
import { ContentTab } from "@/components/admin/ContentTab";
import { ManifestosTab } from "@/components/admin/ManifestosTab";
import { SubmissionsTab } from "@/components/admin/SubmissionsTab";
import { HistoryTab } from "@/components/admin/HistoryTab";
import { VoiceTab } from "@/components/admin/VoiceTab";
import { StudioTab } from "@/components/admin/StudioTab";
import { listSubmissions } from "@/lib/submissions.functions";
import { SiteTab } from "@/components/admin/SiteTab";
import { TeamTab } from "@/components/admin/TeamTab";
import { SecurityTab } from "@/components/admin/SecurityTab";
import { AccountSecurity, MfaGate } from "@/components/admin/Mfa";
import { toast } from "sonner";
import { ignoreStaffDeviceByDefault } from "@/lib/tracker";
import { RegionBar } from "@/components/admin/RegionBar";
import { canManageScope, scopesFor, type Access } from "@/lib/regions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Brief" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session === null) void navigate({ to: "/auth" }); }, [session, navigate]);

  // Sign out after 30 minutes without activity, so an unattended screen can't be used.
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { toast("You were signed out after 30 minutes of inactivity."); void supabase.auth.signOut(); }, 30 * 60_000);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [session]);

  const rolesQ = useQuery({ queryKey: ["my-roles", session?.user.id], queryFn: () => getMyRoles(), enabled: !!session });
  const roles = rolesQ.data?.roles ?? [];
  useEffect(() => { if (roles.length > 0) ignoreStaffDeviceByDefault(); }, [roles.length]);
  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: () => listSubmissions(), enabled: !!session && roles.length > 0 });
  const newSubs = (subsQ.data ?? []).filter((x) => x.status === "pending").length;
  const isAdmin = roles.includes("admin");
  const isEditor = isAdmin || roles.includes("editor");
  // Which regions this person manages, and which one they are working on right now.
  const access: Access = { isAdmin, regions: rolesQ.data?.regions ?? [] };
  const [pickedScope, setPickedScope] = useState<string | null>(null);
  const scopes = scopesFor(access);
  const scope = pickedScope && canManageScope(access, pickedScope) ? pickedScope : (scopes[0] ?? "*");
  const hasScope = scopes.length > 0;

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      {body}
      <Toaster />
    </div>
  );

  if (session === undefined || (session && rolesQ.isLoading)) return shell(<p className="py-24 text-center text-muted-foreground">Loading…</p>);
  if (!session) return shell(<p className="py-24 text-center text-muted-foreground">Redirecting to sign-in…</p>);
  if (!roles.length) {
    return shell(
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-3xl font-black" style={{ fontFamily: "'Fraunces', serif" }}>No access yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">You are signed in as {session.user.email}, but no role has been granted. Ask a site admin to give you the admin, editor or moderator role.</p>
        <Button className="mt-6 rounded-none" variant="outline" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
      </main>,
    );
  }

  return shell(
    <MfaGate>
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <h1 className="text-4xl font-black leading-none" style={{ fontFamily: "'Fraunces', serif" }}>Brief <span className="text-primary">control room</span></h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{session.user.email}{roles.map((r) => <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>)}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-none"><Link to="/">View site</Link></Button>
          <Button variant="outline" className="rounded-none" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
        </div>
      </header>

      <RegionBar access={access} scope={scope} onScope={setPickedScope} />

      <Tabs defaultValue="analytics" className="mt-6">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-none bg-muted p-1">
          <TabsTrigger value="analytics" className="rounded-none">Analytics</TabsTrigger>
          <TabsTrigger value="ads" className="rounded-none">Ads</TabsTrigger>
          <TabsTrigger value="content" className="rounded-none">Content control</TabsTrigger>
          <TabsTrigger value="manifestos" className="rounded-none">Manifestos</TabsTrigger>
          <TabsTrigger value="submissions" className="rounded-none">Submissions{newSubs > 0 && <span className="ml-1.5 bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{newSubs}</span>}</TabsTrigger>
          <TabsTrigger value="history" className="rounded-none">History and trails</TabsTrigger>
          <TabsTrigger value="voice" className="rounded-none">Voice</TabsTrigger>
          {isEditor && <TabsTrigger value="studio" className="rounded-none">Studio</TabsTrigger>}
          {isEditor && <TabsTrigger value="site" className="rounded-none">Themes and banner</TabsTrigger>}
          {isAdmin && <TabsTrigger value="team" className="rounded-none">Team</TabsTrigger>}
          {isAdmin && <TabsTrigger value="security" className="rounded-none">Security</TabsTrigger>}
          <TabsTrigger value="me" className="rounded-none">My security</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="mt-6"><AnalyticsTab /></TabsContent>
        <TabsContent value="ads" className="mt-6">{isEditor && hasScope ? <AdsTab access={access} scope={scope} /> : <p className="py-16 text-center text-muted-foreground">Ads are managed by editors and admins for their regions.</p>}</TabsContent>
        <TabsContent value="content" className="mt-6">{hasScope ? <ContentTab access={access} scope={scope} /> : <p className="py-16 text-center text-muted-foreground">No regions assigned yet.</p>}</TabsContent>
        <TabsContent value="manifestos" className="mt-6"><ManifestosTab canPublish={isEditor} /></TabsContent>
        <TabsContent value="submissions" className="mt-6"><SubmissionsTab canDelete={isEditor} /></TabsContent>
        <TabsContent value="history" className="mt-6"><HistoryTab canEdit={isEditor && hasScope} access={access} scope={scope} /></TabsContent>
        <TabsContent value="voice" className="mt-6"><VoiceTab canEdit={isEditor} /></TabsContent>
        {isEditor && <TabsContent value="studio" className="mt-6">{hasScope ? <StudioTab scope={scope} canEdit={isEditor && canManageScope(access, scope)} /> : <p className="py-16 text-center text-muted-foreground">No regions assigned yet.</p>}</TabsContent>}
        {isEditor && <TabsContent value="site" className="mt-6">{hasScope ? <SiteTab access={access} scope={scope} /> : <p className="py-16 text-center text-muted-foreground">No regions assigned yet.</p>}</TabsContent>}
        {isAdmin && <TabsContent value="team" className="mt-6"><TeamTab /></TabsContent>}
        {isAdmin && <TabsContent value="security" className="mt-6"><SecurityTab /></TabsContent>}
        <TabsContent value="me" className="mt-6"><AccountSecurity /></TabsContent>
      </Tabs>
    </main>
    </MfaGate>,
  );
}
