export interface NicknameOption {
  id: string;
  studentName?: string | null;
  nickname: string;
  voteCount: number;
  createdByUsername?: string | null;
  createdByDisplayName?: string | null;
}

export interface StudentResult {
  id: string;
  fullName: string;
  slug: string;
  nicknames: NicknameOption[];
}

export interface UserVote {
  studentId: string;
  nicknameOptionId: string;
  nickname: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  authUserId: string;
  studentId: string | null;
  username: string;
  displayName: string;
}

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
