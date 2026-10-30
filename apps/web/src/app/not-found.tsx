import Link from "next/link";
import { PageHeader } from "~/components/panel";
import { buttonVariants } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader kicker="Erreur 404" title="Page introuvable">
        Ce serveur, ce joueur ou cette alliance n&apos;existe pas, ou plus.
      </PageHeader>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Retour à l&apos;accueil
        </Link>
        <Link href="/tools" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Les outils
        </Link>
      </div>
    </div>
  );
}
