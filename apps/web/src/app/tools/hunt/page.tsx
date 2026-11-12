import { HuntHelp } from "~/components/tools/hunt/hunt-help";
import { HuntTool } from "~/components/tools/hunt/hunt-tool";
import { toolMetadata } from "~/components/tools/tool-list";
import { ToolPage } from "~/components/tools/tool-page";

export const metadata = toolMetadata("hunt");

export default function HuntToolPage() {
  return (
    <ToolPage tool="hunt" help={<HuntHelp />}>
      <HuntTool />
    </ToolPage>
  );
}
