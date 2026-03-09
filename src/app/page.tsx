import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-8 text-center px-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Now Schema Explorer
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Explore and compare ServiceNow schemas across versions and
          application scopes. Understand table inheritance, view column details,
          and diff your instance against out-of-the-box baselines.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/explorer">Explore Schemas</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/compare">Compare Schemas</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/csdm">CSDM Lifecycle</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/glossary">Glossary</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
