"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import type {
  StudentResult,
  UserVote,
  AuthUser,
  Profile,
  Toast,
} from "@/lib/types";
import Header from "./Header";
import StudentCard from "./StudentCard";
import ToastContainer from "./Toast";
import { nanoid } from "./nanoid";

interface AppProps {
  initialStudents: StudentResult[];
  initialUser: AuthUser | null;
  initialMyVotes: UserVote[];
  initialProfile: Profile | null;
}

export default function App({
  initialStudents,
  initialUser,
  initialMyVotes,
  initialProfile,
}: AppProps) {
  const [students, setStudents] = useState<StudentResult[]>(initialStudents);
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [myVotesMap, setMyVotesMap] = useState<Map<string, UserVote>>(
    () => new Map(initialMyVotes.map((v) => [v.studentId, v]))
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [submittingFor, setSubmittingFor] = useState<Set<string>>(new Set());

  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Toast helpers ─────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = nanoid();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Auth state ────────────────────────────────────────────────────────────

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
        // Fetch profile and votes
        const [profileRes, votesRes] = await Promise.all([
          supabase.rpc("get_my_profile"),
          supabase.rpc("get_my_votes"),
        ]);
        if (profileRes.data) setProfile(profileRes.data as Profile);
        if (Array.isArray(votesRes.data)) {
          setMyVotesMap(
            new Map((votesRes.data as UserVote[]).map((v) => [v.studentId, v]))
          );
        }
      } else {
        setUser(null);
        setProfile(null);
        setMyVotesMap(new Map());
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time vote updates ─────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("public-votes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes" },
        (payload) => {
          const newVote = payload.new as {
            student_id: string;
            nickname_option_id: string;
          };
          setStudents((prev) =>
            prev.map((student) => {
              if (student.id !== newVote.student_id) return student;
              return {
                ...student,
                nicknames: student.nicknames.map((n) =>
                  n.id === newVote.nickname_option_id
                    ? { ...n, voteCount: n.voteCount + 1 }
                    : n
                ),
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nickname_options" },
        async () => {
          // A new nickname was created — re-fetch full results so we see it
          const { data } = await supabase.rpc("get_students_results");
          if (Array.isArray(data)) setStudents(data as StudentResult[]);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voting actions ─────────────────────────────────────────────────────────

  async function handleVoteForNickname(studentId: string, nicknameOptionId: string) {
    if (!user) return;
    setSubmittingFor((prev) => new Set(prev).add(studentId));

    const { data, error } = await supabase.rpc("vote_for_nickname", {
      p_nickname_option_id: nicknameOptionId,
    });

    setSubmittingFor((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });

    if (error || !data?.success) {
      addToast(data?.error ?? error?.message ?? "Failed to vote.", "error");
      return;
    }

    // Optimistically update — realtime will sync the count
    const student = students.find((s) => s.id === studentId);
    const nickname = student?.nicknames.find((n) => n.id === nicknameOptionId);
    if (nickname) {
      setMyVotesMap((prev) =>
        new Map(prev).set(studentId, {
          studentId,
          nicknameOptionId,
          nickname: nickname.nickname,
        })
      );
    }

    addToast("Vote cast! 🎉", "success");
  }

  async function handleSubmitNickname(studentId: string, nickname: string) {
    if (!user) return;
    setSubmittingFor((prev) => new Set(prev).add(studentId));

    const { data, error } = await supabase.rpc("submit_nickname", {
      p_student_id: studentId,
      p_nickname: nickname,
    });

    setSubmittingFor((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });

    if (error || !data?.success) {
      addToast(data?.error ?? error?.message ?? "Failed to submit.", "error");
      return;
    }

    // Update local state immediately
    const nicknameOptionId = data.nickname_option_id as string;
    setMyVotesMap((prev) =>
      new Map(prev).set(studentId, { studentId, nicknameOptionId, nickname })
    );

    // Also update student nicknames list locally if it's a new nickname
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const exists = s.nicknames.find((n) => n.id === nicknameOptionId);
        if (exists) {
          return {
            ...s,
            nicknames: s.nicknames.map((n) =>
              n.id === nicknameOptionId ? { ...n, voteCount: n.voteCount + 1 } : n
            ),
          };
        }
        return {
          ...s,
          nicknames: [
            ...s.nicknames,
            {
              id: nicknameOptionId,
              nickname,
              voteCount: 1,
              createdByUsername: profile?.username ?? null,
              createdByDisplayName: profile?.displayName ?? null,
            },
          ],
        };
      })
    );

    addToast(`"${nickname}" submitted! 🎓`, "success");
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? students.filter((s) =>
        s.fullName.toLowerCase().includes(search.trim().toLowerCase())
      )
    : students;

  const totalVotesCast = students.reduce(
    (sum, s) => sum + s.nicknames.reduce((ns, n) => ns + n.voteCount, 0),
    0
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} profile={profile} onLogout={() => {}} />

      {/* Hero banner */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-medium mb-4 backdrop-blur border border-white/20">
              <span>🎊</span> Class Farewell Event
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-3">
              Nickname Voting
            </h1>
            <p className="text-violet-100 text-lg max-w-xl mx-auto">
              Vote for the funniest or most creative nicknames for your
              classmates. The most-voted nickname wins!
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
              <Stat icon="👥" value={students.length} label="Students" />
              <Stat
                icon="🏷️"
                value={students.reduce((s, st) => s + st.nicknames.length, 0)}
                label="Nicknames"
              />
              <Stat icon="🗳️" value={totalVotesCast} label="Votes cast" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name…"
              className="input-field pl-11 py-3"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {search && (
          <p className="text-center text-sm text-gray-500 mb-6">
            {filtered.length === 0
              ? "No students match your search."
              : `Showing ${filtered.length} of ${students.length} students`}
          </p>
        )}

        {/* Student grid */}
        {students.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No students yet
            </h2>
            <p className="text-gray-400 text-sm">
              The class list hasn&apos;t been set up yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                myVote={myVotesMap.get(student.id)}
                isLoggedIn={!!user}
                onVoteForNickname={handleVoteForNickname}
                onSubmitNickname={handleSubmitNickname}
                isSubmitting={submittingFor.has(student.id)}
              />
            ))}
          </div>
        )}

        {/* Login nudge for logged-out visitors */}
        {!user && students.length > 0 && (
          <div className="mt-12 text-center">
            <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-violet-50 border border-violet-100">
              <span className="text-3xl">🗳️</span>
              <p className="font-semibold text-gray-800">Want to vote?</p>
              <p className="text-sm text-gray-500 max-w-xs">
                Use the credentials shared with you personally to sign in and
                cast your votes.
              </p>
              <a href="/login" className="btn-primary mt-1">
                Sign in now
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-sm text-gray-400">Made by iman jabbar  for our farewell ❤️</p>
      </footer>

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
      <span className="text-xl">{icon}</span>
      <div className="text-left">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-violet-200 leading-none mt-0.5">{label}</p>
      </div>
    </div>
  );
}
