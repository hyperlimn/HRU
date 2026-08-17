import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Panel } from "./components/Panel";
import { Disclosure } from "./components/Disclosure";
import { panelRegistry, SIDEBAR_PANEL_ORDER } from "./panels/registry";

describe("sidebar registry and collapsible hierarchy", () => {
  it("uses the observer workflow ordering rather than registration accident", () => {
    expect(panelRegistry.list().map(({ id }) => id)).toEqual(
      SIDEBAR_PANEL_ORDER,
    );
  });

  it("hides collapsed content without reserving space while preserving panel state", () => {
    const collapsed = renderToStaticMarkup(
      <Panel id="visual-lab" title="Visual Lab">
        <span>hidden controls</span>
      </Panel>,
    );
    const open = renderToStaticMarkup(
      <Panel id="universe" title="Universe" defaultOpen>
        <span>visible controls</span>
      </Panel>,
    );
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).toContain('hidden=""');
    expect(collapsed).toContain("hidden controls");
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain("visible controls");
  });

  it("reveals nested search results through forced disclosures", () => {
    const markup = renderToStaticMarkup(
      <Disclosure title="Entities" forceOpen>
        <span>matched parameter</span>
      </Disclosure>,
    );
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("matched parameter");
  });
});
