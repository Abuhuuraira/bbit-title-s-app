"use client";

import { useState, useRef } from "react";
import type { StudentResult, NicknameOption, UserVote } from "@/lib/types";

interface StudentCardProps {
  student: StudentResult;
  myVote: UserVote | undefined;
  isLoggedIn: boolean;
  onVoteForNickname: (studentId: string, nicknameOptionId: string) => Promise<void>;
  onSubmitNickname: (studentId: string, nickname: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function StudentCard({
  student,
  myVote,
  isLoggedIn,
  onVoteForNickname,
  onSubmitNickname,
  isSubmitting,
}: StudentCardProps) {
  const [newNickname, setNewNickname] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalVotes = student.nicknames.reduce((sum, n) => sum + n.voteCount, 0);
  const topNickname = student.nicknames[0];

  function handleShowInput() {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newNickname.trim();
    if (!trimmed) return;
    await onSubmitNickname(student.id, trimmed);
    setNewNickname("");
    setShowInput(false);
  }

  return (
    <div className="card overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-violet-50/50 to-indigo-50/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">
              {student.fullName}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalVotes === 0
                ? "No votes yet"
                : `${totalVotes} vote${totalVotes !== 1 ? "s" : ""} total`}
            </p>
          </div>
          {topNickname && topNickname.voteCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
              👑 {topNickname.nickname}
            </span>
          )}
        </div>
      </div>

      {/* Nickname list */}
      <div className="px-5 py-4 space-y-2.5">
        {student.nicknames.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-2">
            No nicknames yet — be the first!
          </p>
        ) : (
          student.nicknames.map((option, index) => (
            <NicknameRow
              key={option.id}
              option={option}
              rank={index}
              totalVotes={totalVotes}
              isMyVote={myVote?.nicknameOptionId === option.id}
              canVote={isLoggedIn && !myVote}
              isSubmitting={isSubmitting}
              onVote={() => onVoteForNickname(student.id, option.id)}
            />
          ))
        )}
      </div>

      {/* Action area */}
      <div className="px-5 pb-5">
        {!isLoggedIn ? (
          <a
            href="/login"
            className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign in to vote or suggest a nickname
          </a>
        ) : myVote ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-green-700 font-medium">
              You voted: <span className="font-bold">&ldquo;{myVote.nickname}&rdquo;</span>
            </p>
          </div>
        ) : showInput ? (
          <form onSubmit={handleSubmit} className="flex gap-2 animate-slide-up">
            <input
              ref={inputRef}
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Type a nickname…"
              maxLength={60}
              className="input-field flex-1 text-sm py-2"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !newNickname.trim()}
              className="btn-primary px-3 py-2 text-sm shrink-0"
            >
              {isSubmitting ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Submit"
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowInput(false); setNewNickname(""); }}
              className="btn-ghost px-2 py-2 text-sm"
              disabled={isSubmitting}
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            onClick={handleShowInput}
            className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors group"
          >
            <span className="w-6 h-6 rounded-full bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors text-violet-600 font-bold text-base leading-none">
              +
            </span>
            Suggest a nickname
          </button>
        )}
      </div>
    </div>
  );
}

// ── Nickname row ──────────────────────────────────────────────────────────────

interface NicknameRowProps {
  option: NicknameOption;
  rank: number;
  totalVotes: number;
  isMyVote: boolean;
  canVote: boolean;
  isSubmitting: boolean;
  onVote: () => void;
}

function NicknameRow({
  option,
  rank,
  totalVotes,
  isMyVote,
  canVote,
  isSubmitting,
  onVote,
}: NicknameRowProps) {
  const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;

  const rankColors = ["bg-amber-400", "bg-gray-400", "bg-orange-600"];
  const rankLabels = ["🥇", "🥈", "🥉"];

  return (
    <div
      className={`group relative rounded-xl p-3 transition-all duration-150 ${
        isMyVote
          ? "bg-violet-50 border border-violet-200"
          : "bg-gray-50 hover:bg-gray-100 border border-transparent"
      }`}
    >
      {/* Progress bar */}
      {totalVotes > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isMyVote ? "bg-violet-400" : "bg-gray-300"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-2.5 pb-0.5">
        {/* Rank badge */}
        {rank < 3 && option.voteCount > 0 ? (
          <span className="text-base shrink-0">{rankLabels[rank]}</span>
        ) : (
          <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
            {rank + 1}
          </span>
        )}

        {/* Nickname text */}
        <span
          className={`flex-1 font-semibold text-sm leading-snug ${
            isMyVote ? "text-violet-800" : "text-gray-800"
          }`}
        >
          {option.nickname}
          {isMyVote && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-violet-500">
              ✓ yours
            </span>
          )}
        </span>

        {/* Vote count */}
        <span
          className={`text-sm font-bold tabular-nums shrink-0 ${
            isMyVote ? "text-violet-600" : "text-gray-600"
          }`}
        >
          {option.voteCount}
          <span className="font-normal text-xs ml-0.5 text-gray-400">
            {option.voteCount === 1 ? "vote" : "votes"}
          </span>
        </span>

        {/* Vote button */}
        {canVote && (
          <button
            onClick={onVote}
            disabled={isSubmitting}
            className="btn-vote ml-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            Vote
          </button>
        )}
      </div>
    </div>
  );
}
