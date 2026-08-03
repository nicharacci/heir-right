import {
  ClientSideRowModelModule,
  ModuleRegistry,
  PaginationModule,
  QuickFilterModule,
  RowApiModule,
  RowSelectionModule,
  TextFilterModule,
  createGrid,
  themeQuartz,
} from "ag-grid-community";

const registeredCommunityModules = Object.freeze([
  ClientSideRowModelModule,
  PaginationModule,
  QuickFilterModule,
  RowApiModule,
  RowSelectionModule,
  TextFilterModule,
]);

ModuleRegistry.registerModules(registeredCommunityModules);

const heirRightGridTheme = themeQuartz.withParams({
  accentColor: "var(--hr-accent)",
  backgroundColor: "var(--hr-surface)",
  borderColor: "var(--hr-ruler)",
  browserColorScheme: "inherit",
  chromeBackgroundColor: "var(--hr-chrome)",
  foregroundColor: "var(--hr-text)",
  fontFamily: "var(--hr-font-sans)",
  fontSize: 13,
  headerBackgroundColor: "var(--hr-chrome)",
  headerFontSize: 12,
  headerFontWeight: 700,
  headerTextColor: "var(--hr-text-muted)",
  oddRowBackgroundColor: "color-mix(in srgb, var(--hr-text) 2%, transparent)",
  rowHoverColor: "color-mix(in srgb, var(--hr-text) 6%, transparent)",
  selectedRowBackgroundColor: "var(--hr-surface-selected)",
  spacing: 7,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
});

const mountedGrids = new Map();

function destroyCommunityGrid(key) {
  const mounted = mountedGrids.get(key);
  if (!mounted) return false;
  try {
    mounted.api.destroy();
  } catch {
    // A detached grid can already be destroyed by AG Grid.
  }
  mountedGrids.delete(key);
  return true;
}

function selectionConfig(mode) {
  if (mode === "single") {
    return {
      mode: "singleRow",
      checkboxes: false,
      enableClickSelection: true,
    };
  }
  return {
    mode: "multiRow",
    checkboxes: true,
    headerCheckbox: true,
    enableClickSelection: true,
    selectAll: "filtered",
  };
}

function interactiveGridTarget(event) {
  return Boolean(event?.target?.closest?.("button, a, input, select, textarea, [contenteditable='true'], .ag-selection-checkbox, [role='checkbox']"));
}

function edgeResizeGuardedColumnDefs(columns) {
  const source = Array.isArray(columns) ? columns : [];
  const lastIndex = source.length - 1;
  return source.map((column, index) => ({
    ...column,
    resizable: column?.resizable === false ? false : index > 0 && index < lastIndex,
  }));
}

function createCommunityGrid(container, {
  key,
  rows,
  columns,
  selectionMode = "multi",
  selectedIds = [],
  pageSize = 10,
  emptyMessage = "No rows match this view.",
  onOpen = null,
  onSelect = null,
  onSelectionChange = null,
} = {}) {
  if (!container || !key) throw new TypeError("A grid container and key are required.");
  destroyCommunityGrid(key);
  const initiallySelected = new Set(selectedIds.map(String));
  const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const api = createGrid(container, {
    theme: heirRightGridTheme,
    rowData: Array.isArray(rows) ? rows : [],
    columnDefs: edgeResizeGuardedColumnDefs(columns),
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 110,
      flex: 1,
      suppressHeaderMenuButton: false,
      suppressKeyboardEvent: ({ event, node }) => {
        if (event.key !== " " || !node?.data || interactiveGridTarget(event)) return false;
        event.preventDefault();
        node.setSelected(!node.isSelected());
        return true;
      },
    },
    selectionColumnDef: {
      resizable: false,
      suppressHeaderMenuButton: true,
    },
    getRowId: ({ data }) => String(data.id),
    rowSelection: selectionConfig(selectionMode),
    pagination: true,
    paginationPageSize: pageSize,
    paginationPageSizeSelector: [10, 25, 50],
    rowHeight: 52,
    headerHeight: 46,
    animateRows: !reduceMotion,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    overlayNoRowsTemplate: `<span class="hr-grid-empty">${emptyMessage}</span>`,
    onFirstDataRendered: ({ api: gridApi }) => {
      if (!initiallySelected.size) return;
      gridApi.forEachNode((node) => {
        if (initiallySelected.has(String(node.data?.id))) node.setSelected(true);
      });
    },
    onRowClicked: ({ data, node, event }) => {
      if (!data || interactiveGridTarget(event)) return;
      onSelect?.(data, node);
    },
    onCellKeyDown: ({ event, data, node }) => {
      if (event.key !== "Enter" || !data || interactiveGridTarget(event)) return;
      event.preventDefault();
      onOpen?.(data, node);
    },
    onSelectionChanged: ({ api: gridApi }) => {
      onSelectionChange?.(gridApi.getSelectedRows());
    },
  });
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", container.dataset.gridLabel || "Operational data grid");
  container.setAttribute("data-hr-table-edge-resize", "guarded");
  mountedGrids.set(key, { api, container });
  return api;
}

function setGridQuickFilter(api, value) {
  api?.setGridOption?.("quickFilterText", String(value || ""));
}

function setGridRows(api, rows) {
  api?.setGridOption?.("rowData", Array.isArray(rows) ? rows : []);
}

function gridStatus(root, message, tone = "neutral") {
  const status = root?.querySelector?.("[data-grid-status]");
  if (!status) return;
  status.textContent = String(message || "");
  status.dataset.tone = tone;
}

export {
  createCommunityGrid,
  destroyCommunityGrid,
  edgeResizeGuardedColumnDefs,
  gridStatus,
  heirRightGridTheme,
  interactiveGridTarget,
  registeredCommunityModules,
  setGridQuickFilter,
  setGridRows,
};
