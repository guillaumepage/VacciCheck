import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { renderPdfToImages } from "@/lib/pdf-render.client";
import { extractVaccinationCarnet, type ExtractResult } from "@/lib/vaccine-extract.functions";

export const Route = createFileRoute("/_authenticated/vaccicheck")({
  component: VacciCheckPage,
});

function VacciCheckPage() {
  const extract = useServerFn(extractVaccinationCarnet);
  const [file, setFile] = useState<File | null>(null);
  const [expected, setExpected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      setStage("Rendu du PDF en images…");
      const images = await renderPdfToImages(file);
      setStage(`Analyse de ${images.length} page(s) par l'IA…`);
      const res = await extract({
        data: {
          filename: file.name,
          pageImages: images,
          expectedEntries: expected ? Number(expected) : undefined,
        },
      });
      setResult(res);
      toast.success(`Extraction terminée : ${res.entries.length} entrée(s) trouvée(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">VacciCheck</h1>
        <p className="text-muted-foreground mt-1">
          Téléverse un carnet de vaccination PDF. L'IA lit chaque page comme un humain et reconstruit le tableau complet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Importer un carnet</CardTitle>
          <CardDescription>Format PDF (max 50 pages). Le nombre attendu est optionnel et sert au contrôle qualité.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-[1fr_200px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pdf">Fichier PDF</Label>
                <Input
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expected">Entrées attendues (optionnel)</Label>
                <Input
                  id="expected"
                  type="number"
                  min={0}
                  placeholder="ex. 41"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <Button type="submit" disabled={!file || busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{stage || "Traitement…"}</> : "Lancer l'extraction"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Résultats</CardTitle>
                <CardDescription>
                  {result.entries.length} entrée(s) sur {result.pageCount} page(s)
                  {expected && ` — attendu : ${expected}`}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowRaw((v) => !v)}>
                <FileText className="h-4 w-4" />{showRaw ? "Cacher" : "Voir"} le Markdown brut
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {expected && Number(expected) !== result.entries.length && (
              <div className="rounded-md border border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm">
                Écart détecté : {result.entries.length} extrait(es) vs {expected} attendu(es). Vérifiez le Markdown brut pour identifier les lignes manquantes.
              </div>
            )}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vaccin</TableHead>
                    <TableHead>Nom commercial</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Dose</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.entries.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{e.given_at ?? "—"}</TableCell>
                      <TableCell className="font-medium">{e.vaccine_generic ?? "—"}</TableCell>
                      <TableCell>{e.commercial_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.lot ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.site ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.dose ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.notes ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{e.page_number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {showRaw && (
              <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap max-h-[500px]">
                {result.rawMarkdown}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
