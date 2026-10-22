import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-muted-foreground">Ce serveur, ce joueur ou cette alliance n&apos;existe pas, ou plus.</p>
      <Link href="/" className="underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
