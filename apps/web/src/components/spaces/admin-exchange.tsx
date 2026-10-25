"use client";

// The Code de sécurité seen from someone who needs an Admin: the newcomer after their request, a member whose access
// must be sent again, or whose Admin's key changed. They choose the Admin they talk to (skipped when there is one),
// then exchange codes; a matching code puts the Admin's key in their trust list, and they accept what it signs.
import { useState } from "react";
import { withVerified } from "~/lib/spaces/trust-store";
import { CodeExchange } from "./code-exchange";
import { useSpaceKeys } from "./space-keys";

export interface AdminContact {
  pseudo: string;
  publicKey: string;
}

export function AdminExchange({
  spaceId,
  admins,
  verified,
}: {
  spaceId: string;
  admins: AdminContact[];
  /** Whether one already compared codes with this key. */
  verified: (publicKey: string) => boolean;
}) {
  const { publicKey, updateTrust } = useSpaceKeys();
  const [chosen, setChosen] = useState<string | null>(null);
  const admin = admins.length === 1 ? admins[0] : admins.find((a) => a.publicKey === chosen);

  if (!publicKey) return null;
  if (admins.length === 0)
    return (
      <p className="text-muted-foreground">Aucun Admin de l&apos;espace ne peut vous répondre pour l&apos;instant.</p>
    );

  return (
    <div className="space-y-3">
      {admins.length > 1 && (
        <fieldset className="space-y-1">
          <legend>Avec quel Admin parlez-vous&nbsp;?</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {admins.map((a) => (
              <label key={a.publicKey} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`admin-${spaceId}`}
                  checked={chosen === a.publicKey}
                  onChange={() => setChosen(a.publicKey)}
                />
                {a.pseudo}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {admin && (
        <CodeExchange
          key={admin.publicKey}
          mine={publicKey}
          theirs={admin.publicKey}
          pseudo={admin.pseudo}
          side="newcomer"
          done={verified(admin.publicKey)}
          onMatch={async () => {
            await updateTrust((list) =>
              withVerified(list, spaceId, { publicKey: admin.publicKey, role: "admin", verifiedAt: Date.now() }),
            );
          }}
        />
      )}
    </div>
  );
}
