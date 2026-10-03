import { QueryClient } from "@tanstack/react-query";
import { clearSession } from "./session";

/** Drop auth, cancel API work, and wipe cached user data for the previous wallet. */
export function resetIdentityState(queryClient: QueryClient): void {
  clearSession();
  queryClient.cancelQueries();
  queryClient.clear();
}
