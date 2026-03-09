import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Database, Snowflake, ArrowRight, Building2 } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar with theme toggle */}
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      {/* Main content centered */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
        <div className="flex flex-col items-center gap-10 text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Metadata Explorer
            </h1>
            <p className="mt-3 max-w-lg text-lg text-muted-foreground">
              Explore, compare, and catalog schemas across your technology
              platforms.
            </p>
          </div>

          {/* Platform cards grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-2xl w-full">
            {/* ServiceNow — active */}
            <Link href="/explorer" className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-foreground/20 group-hover:bg-accent/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Database className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">ServiceNow</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    Tables, columns, inheritance, references, and CSDM
                    lifecycle mapping.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">Explorer</Badge>
                    <Badge variant="secondary" className="text-xs">Compare</Badge>
                    <Badge variant="secondary" className="text-xs">Catalog</Badge>
                    <Badge variant="secondary" className="text-xs">CSDM</Badge>
                    <Badge variant="secondary" className="text-xs">Glossary</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open Explorer
                    <ArrowRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Snowflake — coming soon */}
            <div aria-disabled="true">
              <Card className="h-full opacity-50 cursor-not-allowed">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Snowflake className="size-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">Snowflake</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        Coming Soon
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    Databases, schemas, views, tables, and column lineage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs opacity-50">Explorer</Badge>
                    <Badge variant="secondary" className="text-xs opacity-50">Compare</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enterprise — coming soon, spans full width */}
            <div aria-disabled="true" className="sm:col-span-2">
              <Card className="opacity-50 cursor-not-allowed">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Building2 className="size-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">Enterprise</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        Coming Soon
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    Explore data across the organization — data assets, data
                    products, enterprise data model, and cross-platform
                    lineage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs opacity-50">Data Assets</Badge>
                    <Badge variant="secondary" className="text-xs opacity-50">Data Products</Badge>
                    <Badge variant="secondary" className="text-xs opacity-50">Enterprise Data Model</Badge>
                    <Badge variant="secondary" className="text-xs opacity-50">Lineage</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
