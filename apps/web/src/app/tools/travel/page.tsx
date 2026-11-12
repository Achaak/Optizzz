import { TravelHelp } from "~/components/tools/travel/travel-help";
import { ToolPage } from "~/components/tools/tool-page";
import { toolMetadata } from "~/components/tools/tool-list";
import { TravelTool } from "~/components/tools/travel/travel-tool";

export const metadata = toolMetadata("travel");

export default function TravelPage() {
  return (
    <ToolPage tool="travel" help={<TravelHelp />}>
      <TravelTool />
    </ToolPage>
  );
}
