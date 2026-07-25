import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Volume2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import JournalCard from "@/components/journal/JournalCard";
import {
  fetchJournalPost,
  fetchJournalPosts,
} from "@/services/api/journalServer";
import {
  categoryLabel,
  formatDuration,
  formatJournalDate,
  splitParagraphs,
} from "@/services/api/journal";

/* -------------------------------------------------------------------------- */
/*  /blog/[slug] — one Journal post                                         */
/*                                                                            */
/*  Server-rendered with ISR. Drafts and unknown slugs 404 (the public backend  */
/*  only serves published posts, so a null read IS the 404).                    */
/*                                                                            */
/*  The body is PLAIN TEXT: paragraphs split on blank lines and render as <p>   */
/*  elements. There is no HTML in the body and dangerouslySetInnerHTML is never */
/*  used, so the post surface carries no XSS surface at all.                    */
/* -------------------------------------------------------------------------- */

export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await fetchJournalPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await fetchJournalPost(params.slug);
  if (!post) return { title: "Journal | WillpowerLab" };
  const title = post.metaTitle ?? `${post.title} | WillpowerLab`;
  const description = post.metaDescription ?? post.excerpt;
  const image = post.ogImageUrl ?? post.coverImageUrl;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      url: `https://www.willpowerlab.com/blog/${post.slug}`,
      type: "article",
      ...(image ? { images: [{ url: image, alt: post.coverAlt ?? post.title }] } : {}),
    },
  };
}

export default async function JournalPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await fetchJournalPost(params.slug);
  if (!post) notFound();

  const paragraphs = splitParagraphs(post.body);
  const date = formatJournalDate(post.publishedAt);
  const duration = formatDuration(post.mediaDurationSec);
  const meta = [
    categoryLabel(post.category),
    post.readTimeMin ? `${post.readTimeMin} min read` : null,
    date,
  ].filter(Boolean);

  // Related: same category, never the post itself, at most 3.
  const related = (await fetchJournalPosts())
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="bg-background text-foreground">
      <SiteHeader />

      <main className="pb-20">
        <div className="mx-auto max-w-2xl px-6 pt-10">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground no-underline transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Journal
          </Link>

          <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {meta.join(" · ")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background"
              aria-hidden
            >
              {post.authorName.trim().charAt(0).toUpperCase() || "W"}
            </span>
            <span className="text-sm text-foreground">{post.authorName}</span>
          </div>
        </div>

        {/* Cover — slightly wider than the reading column. */}
        {post.coverKind === "image" && post.coverImageUrl ? (
          <div className="mx-auto mt-10 max-w-3xl px-6">
            <div className="overflow-hidden rounded-3xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverImageUrl}
                alt={post.coverAlt ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ) : null}

        {post.coverKind === "video" && post.mediaUrl ? (
          <div className="mx-auto mt-10 max-w-3xl px-6">
            {/* Fixed 16:9 box with object-contain: an unconstrained <video>
                takes the aspect of its poster (or 300x150 until metadata
                loads, which shifts the layout), so a portrait clip would
                render taller than the screen. Letterbox instead of crop. */}
            <div className="aspect-video overflow-hidden rounded-3xl bg-muted">
              <video
                controls
                preload="metadata"
                poster={post.coverImageUrl ?? undefined}
                className="h-full w-full object-contain"
              >
                <source src={post.mediaUrl} />
              </video>
            </div>
          </div>
        ) : null}

        {post.coverKind === "audio" && post.mediaUrl ? (
          <div className="mx-auto mt-10 max-w-3xl px-6">
            <div className="rounded-3xl bg-journal-media p-6">
              <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5" aria-hidden />
                Audio recording{duration ? ` · ${duration}` : ""}
              </p>
              <audio controls preload="metadata" className="w-full">
                <source src={post.mediaUrl} />
              </audio>
            </div>
          </div>
        ) : null}

        {/* Body — plain text, one <p> per blank-line-separated block. */}
        <article className="mx-auto mt-12 max-w-2xl space-y-6 px-6">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              // whitespace-pre-line: when a body mixes blank-line paragraphs
              // with single newlines inside one (a list, an address), those
              // breaks must survive instead of collapsing into spaces.
              className="whitespace-pre-line text-[17px] leading-[1.75] text-foreground/90"
            >
              {p}
            </p>
          ))}
        </article>

        <div className="mx-auto max-w-2xl px-6">
          <hr className="my-14 border-border" />
          <div className="flex items-center justify-between text-sm">
            <Link
              href="/blog"
              className="text-muted-foreground no-underline transition hover:text-foreground"
            >
              ← All posts
            </Link>
            <span className="text-muted-foreground">
              Filed in {categoryLabel(post.category)}
            </span>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-border/70">
            <div className="mx-auto max-w-5xl px-6 py-12">
              {/* A real heading, not a styled <p>: it names the section and
                  keeps the document from skipping h1 straight to the cards. */}
              <h2 className="mb-8 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                More in {categoryLabel(post.category)}
              </h2>
              <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <JournalCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
