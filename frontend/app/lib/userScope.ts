// Provides a user-scoped suffix for localStorage keys.
// When logged in: "_u42" (user id 42). When guest: "".
// This means each user has isolated keys, e.g. "newsagg_bookmarks_u42".

const SCOPE_KEY = "newsagg_current_user_id";

export function getUserScope(): string {
  if (typeof window === "undefined") return "";
  const id = localStorage.getItem(SCOPE_KEY);
  return id ? `_u${id}` : "";
}

export function setUserScope(userId: number | null) {
  if (typeof window === "undefined") return;
  if (userId === null) {
    localStorage.removeItem(SCOPE_KEY);
  } else {
    localStorage.setItem(SCOPE_KEY, String(userId));
  }
}
