import { CostsTool } from "~/components/tools/costs/costs-tool";
import { toolMetadata } from "~/components/tools/tool-list";
import { ToolPage } from "~/components/tools/tool-page";

export const metadata = toolMetadata("costs");

export default function CostsPage() {
  return (
    <ToolPage tool="costs">
      <CostsTool />
    </ToolPage>
  );
}
