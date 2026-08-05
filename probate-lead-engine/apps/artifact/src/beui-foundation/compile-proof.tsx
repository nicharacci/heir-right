import * as AnimatedBadgeModule from "./components/motion/animated-badge";
import * as AnimatedSidebarModule from "./components/motion/animated-sidebar";
import * as ButtonBaseModule from "./components/motion/button/base";
import * as CheckboxModule from "./components/motion/checkbox";
import * as FileUploadModule from "./components/motion/file-upload";
import * as InputModule from "./components/motion/input";
import * as LoaderModule from "./components/motion/loader";
import * as PopoverModule from "./components/motion/popover";
import * as SelectModule from "./components/motion/select";
import * as SwitchModule from "./components/motion/switch";
import * as TableModule from "./components/motion/table";
import * as TooltipModule from "./components/motion/tooltip";

/**
 * Compile-only import surface. The legacy entry point does not import or mount it.
 */
export const beuiFoundationCompileProof = Object.freeze({
  AnimatedBadgeModule,
  AnimatedSidebarModule,
  ButtonBaseModule,
  CheckboxModule,
  FileUploadModule,
  InputModule,
  LoaderModule,
  PopoverModule,
  SelectModule,
  SwitchModule,
  TableModule,
  TooltipModule,
});
