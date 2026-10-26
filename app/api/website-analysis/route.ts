import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are allowed." }, { status: 400 });
  }

  try {
    const res = await fetch(target.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "OmniAI-WebsiteAnalyzer/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch site: status ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }
    const html = (await res.text()).slice(0, 500_000);

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : "";

    const headings = Array.from(html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi))
      .map((m) => m[0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 40);

    const linkCount = (html.match(/<a\s/gi) || []).length;
    const imgCount = (html.match(/<img\s/gi) || []).length;
    const imgsWithAlt = (html.match(/<img[^>]+alt=["'][^"']+["']/gi) || []).length;

    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
    const canonical = canonicalMatch ? canonicalMatch[1] : "";

    const result = {
      url: target.toString(),
      status: res.status,
      title,
      description,
      canonical,
      headingCount: headings.length,
      headings,
      linkCount,
      imageCount: imgCount,
      imagesWithAlt: imgsWithAlt,
      contentLength: html.length,
      analysisSummary:
        "OmniAI website analysis: site fetched successfully. " +
        (title ? "Title present. " : "MISSING title tag. ") +
        (description ? "Meta description present. " : "MISSING meta description. ") +
        (imgsWithAlt < imgCount ? `${imgCount - imgsWithAlt} images missing alt text. ` : "All images have alt text. ") +
        `Found ${headings.length} headings, ${linkCount} links, ${imgCount} images.`,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Analysis failed: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 },
    );
  }
}
