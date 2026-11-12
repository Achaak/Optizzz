import { CombatHelp } from "~/components/tools/combat/combat-help";
import { CombatTool } from "~/components/tools/combat/combat-tool";
import { toolMetadata } from "~/components/tools/tool-list";
import { ToolPage } from "~/components/tools/tool-page";

export const metadata = toolMetadata("combat");

export default function CombatToolPage() {
  return (
    <ToolPage tool="combat" help={<CombatHelp />}>
      <CombatTool />
    </ToolPage>
  );
}
