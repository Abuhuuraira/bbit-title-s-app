import { createClient } from "@/lib/supabase-server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import type { StudentResult, UserVote, Profile } from "@/lib/types";
import App from "@/components/App";

export const revalidate = 0; // always fresh

export default async function HomePage() {
  // Verify admin authentication server-side
  verifyAdminAuth();

  const supabase = createClient();

  // Fetch public students + nicknames (works for everyone, including anon)
  const { data: studentsRaw } = await supabase.rpc("get_students_results");
  const students: StudentResult[] = Array.isArray(studentsRaw) ? studentsRaw : [];

  // Check auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myVotes: UserVote[] = [];
  let profile: Profile | null = null;

  if (user) {
    const [votesResult, profileResult] = await Promise.all([
      supabase.rpc("get_my_votes"),
      supabase.rpc("get_my_profile"),
    ]);

    if (Array.isArray(votesResult.data)) {
      myVotes = votesResult.data as UserVote[];
    }
    if (profileResult.data) {
      profile = profileResult.data as Profile;
    }
  }

  return (
    <App
      initialStudents={students}
      initialUser={user ? { id: user.id, email: user.email ?? "" } : null}
      initialMyVotes={myVotes}
      initialProfile={profile}
    />
  );
}
