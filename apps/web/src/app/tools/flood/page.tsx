import { FloodHelp } from "~/components/tools/flood/flood-help";
import { FloodTool } from "~/components/tools/flood/flood-tool";
import { toolMetadata } from "~/components/tools/tool-list";
import { ToolPage } from "~/components/tools/tool-page";

export const metadata = toolMetadata("flood");

export default function FloodToolPage() {
  return (
    <ToolPage tool="flood" help={<FloodHelp />}>
      <FloodTool />
    </ToolPage>
  );
}
