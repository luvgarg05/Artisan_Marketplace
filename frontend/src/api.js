// Small wrapper around fetch for calling the backend.
// - Prefixes the API base URL
// - Attaches the login token (saved at login/registration) as a Bearer header
// - If the server says the session is invalid, clears it and sends the user to log in
const API_URL = process.env.REACT_APP_API_URL;
const TOKEN_KEY = "authToken";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("userData");
  localStorage.removeItem("verified");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    clearSession();
    window.location.assign("/login");
  }
  return res;
}
