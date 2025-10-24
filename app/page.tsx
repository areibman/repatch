"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CodeBracketIcon, CalendarIcon, UsersIcon } from "@heroicons/react/16/solid"

import { CreatePostDialog } from "@/components/create-post-dialog"
import { MagicCard, type MagicCardAccent } from "@/components/magicui/magic-card"
import { ShinyButton } from "@/components/magicui/shiny-button"
import { StatCard } from "@/components/magicui/stat-card"
import { TimeBadge } from "@/components/magicui/time-badge"
import { formatFilterSummary } from "@/lib/filter-utils"
import { CommitSummary, PatchNote } from "@/types/patch-note"

const TIME_ACCENTS: Record<PatchNote["timePeriod"], MagicCardAccent> = {
  "1day": "sky",
  "1week": "emerald",
  "1month": "violet",
  custom: "amber",
  release: "rose",
}

export default function Home() {
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPatchNotes = async () => {
      try {
        const response = await fetch("/api/patch-notes")
        if (!response.ok) {
          throw new Error("Failed to fetch patch notes")
        }
        const data = await response.json()

        const transformedData = data.map(
          (note: {
            id: string
            repo_name: string
            repo_url: string
            time_period: "1day" | "1week" | "1month" | "custom" | "release"
            generated_at: string
            title: string
            content: string
            changes: { added: number; modified: number; removed: number }
            contributors: string[]
            video_url?: string | null
            repo_branch?: string | null
            ai_summaries?: CommitSummary[] | null
            ai_overall_summary?: string | null
            ai_template_id?: string | null
            filter_metadata?: unknown
          }) => ({
            id: note.id,
            repoName: note.repo_name,
            repoUrl: note.repo_url,
            timePeriod: note.time_period,
            generatedAt: new Date(note.generated_at),
            title: note.title,
            content: note.content,
            changes: note.changes,
            contributors: note.contributors,
            videoUrl: note.video_url,
            repoBranch: note.repo_branch,
            aiSummaries: note.ai_summaries as CommitSummary[] | null,
            aiOverallSummary: note.ai_overall_summary,
            aiTemplateId: note.ai_template_id,
            filterMetadata: note.filter_metadata ?? null,
          })
        )

        setPatchNotes(transformedData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPatchNotes()
  }, [])

  const getFilterLabel = (note: PatchNote) =>
    formatFilterSummary(note.filterMetadata, note.timePeriod)

  const getAccent = (timePeriod: PatchNote["timePeriod"]) =>
    TIME_ACCENTS[timePeriod] ?? "slate"

  const totalPosts = patchNotes.length
  const uniqueRepositories = useMemo(
    () => new Set(patchNotes.map((p) => p.repoName)).size,
    [patchNotes]
  )
  const monthlyPosts = useMemo(() => {
    const now = new Date()
    return patchNotes.filter((p) => {
      const date = new Date(p.generatedAt)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length
  }, [patchNotes])
  const dailyUpdates = useMemo(
    () => patchNotes.filter((p) => p.timePeriod === "1day").length,
    [patchNotes]
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <span className="rounded-full border border-border/60 bg-background/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Loading
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">
          Gathering the latest commits and changelog details from your repositories…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <MagicCard accent="rose" className="max-w-md" contentClassName="space-y-4 p-8 text-center">
          <p className="text-lg font-semibold text-rose-100">
            We couldn’t load your patch notes
          </p>
          <p className="text-sm text-rose-200/80">{error}</p>
          <div className="flex justify-center">
            <ShinyButton
              type="button"
              shineVariant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </ShinyButton>
          </div>
        </MagicCard>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      <div className="pointer-events-none absolute inset-x-0 top-[-12rem] -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_60%)]" />

      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex items-center justify-between px-4 py-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Repatch
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-crafted patch notes pulled straight from your repositories.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ShinyButton asChild shineVariant="outline" shimmer={false} className="rounded-full px-5 py-2">
              <Link href="/settings/templates">Templates</Link>
            </ShinyButton>
            <CreatePostDialog />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            accent="sky"
            label="Total Posts"
            value={totalPosts}
            helperText="Automated recaps generated across your workspaces"
            delta={`${monthlyPosts} shipped this month`}
            deltaTone={monthlyPosts > 0 ? "positive" : "neutral"}
            icon={<CodeBracketIcon className="h-5 w-5" />}
          />
          <StatCard
            accent="emerald"
            label="Repositories"
            value={uniqueRepositories}
            helperText="Active sources currently connected"
            delta={`${dailyUpdates} daily updates in the queue`}
            deltaTone={dailyUpdates > 0 ? "positive" : "neutral"}
            icon={<UsersIcon className="h-5 w-5" />}
          />
          <StatCard
            accent="violet"
            label="This Month"
            value={monthlyPosts}
            helperText="Fresh AI summaries ready to publish"
            delta={totalPosts ? `${totalPosts} total generated` : "Launch your first recap"}
            deltaTone={totalPosts ? "neutral" : "positive"}
            icon={<CalendarIcon className="h-5 w-5" />}
          />
        </section>

        <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {patchNotes.map((note) => {
            const accent = getAccent(note.timePeriod)
            return (
              <Link key={note.id} href={`/blog/${note.id}`} className="group block h-full focus-visible:outline-none">
                <MagicCard accent={accent} className="h-full" contentClassName="flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <TimeBadge accent={accent}>{getFilterLabel(note)}</TimeBadge>
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[0.65rem] text-muted-foreground/80">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {new Date(note.generatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold leading-tight text-foreground transition-colors group-hover:text-white">
                      {note.title}
                    </h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground/85">
                      {note.content}
                    </p>
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/70">
                      <CodeBracketIcon className="h-3.5 w-3.5" />
                      {note.repoName}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center text-xs font-medium">
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-emerald-200">
                      <span className="block text-sm font-semibold">
                        +{note.changes.added.toLocaleString()}
                      </span>
                      <span className="text-[0.65rem] font-normal uppercase tracking-[0.28em] text-emerald-200/80">
                        added
                      </span>
                    </div>
                    <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-rose-200">
                      <span className="block text-sm font-semibold">
                        -{note.changes.removed.toLocaleString()}
                      </span>
                      <span className="text-[0.65rem] font-normal uppercase tracking-[0.28em] text-rose-200/80">
                        removed
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground/85">
                    <div className="flex items-center gap-1.5">
                      <UsersIcon className="h-3.5 w-3.5" />
                      <span>
                        {note.contributors.length} contributor
                        {note.contributors.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-semibold text-primary transition-colors group-hover:text-white">
                      Read more →
                    </span>
                  </div>
                </MagicCard>
              </Link>
            )
          })}
        </section>

        {patchNotes.length === 0 && (
          <div className="mt-16 flex justify-center">
            <MagicCard accent="slate" className="max-w-xl" contentClassName="space-y-4 p-12 text-center">
              <CodeBracketIcon className="mx-auto h-10 w-10 text-muted-foreground/80" />
              <h3 className="text-xl font-semibold">No patch notes yet</h3>
              <p className="text-sm text-muted-foreground">
                Connect a repository and generate your first AI-crafted recap to see it appear here.
              </p>
              <CreatePostDialog />
            </MagicCard>
          </div>
        )}
      </main>
    </div>
  )
}
