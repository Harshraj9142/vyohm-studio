import page from "@/data/page.json";
import { SitePage } from "@/components/site/render";

/** The landing page. Content, order, styles and mobile overrides come from data/page.json. */
export default function Home() {
  return <SitePage data={page} />;
}
