/** Shared query param for AdminShell → requests list search */
export const ADMIN_SEARCH_PARAM = "q";

export function adminRequestsSearchUrl(query: string): { to: "/admin/requests"; search: { q: string } } {
  return {
    to: "/admin/requests",
    search: { q: query.trim() },
  };
}
