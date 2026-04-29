import { redirect } from "next/navigation";

export default function DiscoverPage() {
  // Discover is not in MVP scope — send users back to the feed.
  redirect("/feed");
}
