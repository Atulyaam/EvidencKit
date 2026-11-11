import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  tokens,
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  RadioGroup,
  Radio,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Panel,
  Badge,
  StatusDot,
  StatusIndicator,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  ConfirmDialog,
  Tooltip,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Spinner,
  LoadingState,
  EmptyState,
  ErrorState,
  Alert,
  Breadcrumbs,
  BreadcrumbItem,
  NavPill
} from "@evidencekit/ui";

describe("Part 2 — Shared Design System Foundations & Tokens", () => {
  it("exports comprehensive design tokens covering brand, semantic, typography, spacing, and elevation", () => {
    // Brand palettes
    expect(tokens.colors.brand.tracevault).toBeDefined();
    expect(tokens.colors.brand.tracevault[500]).toBe("#3b82f6");
    expect(tokens.colors.brand.agentledger).toBeDefined();
    expect(tokens.colors.brand.agentledger[500]).toBe("#a855f7");

    // Semantic palettes
    expect(tokens.colors.semantic.success).toBeDefined();
    expect(tokens.colors.semantic.warning).toBeDefined();
    expect(tokens.colors.semantic.danger).toBeDefined();
    expect(tokens.colors.semantic.info).toBeDefined();

    // Dark & light theme variables
    expect(tokens.colors.dark.background).toBe("#09090b");
    expect(tokens.colors.dark.border).toBe("#27272a");
    expect(tokens.colors.light.background).toBe("#ffffff");

    // Typography scale
    expect(tokens.typography.fontSizes.xs.fontSize).toBe("0.75rem");
    expect(tokens.typography.fontSizes.sm.fontSize).toBe("0.875rem");
    expect(tokens.typography.fontSizes.base.fontSize).toBe("1rem");
    expect(tokens.typography.fontWeights.semibold).toBe(600);

    // Spacing, radii, elevation
    expect(tokens.spacing[4]).toBe("1rem");
    expect(tokens.radii.lg).toBe("0.5rem");
    expect(tokens.shadows.md).toBeDefined();
    expect(tokens.breakpoints.md).toBe("768px");
    expect(tokens.states.focusRing).toBeDefined();
  });
});

describe("Part 2 — Core UI Component Primitives", () => {
  describe("Buttons & IconButtons", () => {
    it("renders Button with default variant, size, and accessible attributes", () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { variant: "primary", size: "md" }, "Click Me")
      );
      expect(html).toContain("Click Me");
      expect(html).toContain("bg-blue-600");
    });

    it("renders Button with isLoading spinner and disabled state", () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { isLoading: true }, "Loading Action")
      );
      expect(html).toContain("disabled");
      expect(html).toContain("animate-spin");
    });

    it("renders IconButton with aria-label", () => {
      const html = renderToStaticMarkup(
        React.createElement(IconButton, {
          "aria-label": "Close modal",
          variant: "ghost",
          size: "sm",
          icon: React.createElement("span", null, "X")
        })
      );
      expect(html).toContain('aria-label="Close modal"');
    });
  });

  describe("Form Controls: Input, Textarea, Select, Checkbox, Switch, Radio", () => {
    it("renders Input with label, error message, and aria-invalid", () => {
      const html = renderToStaticMarkup(
        React.createElement(Input, {
          label: "Session ID",
          error: "Invalid session UUID format",
          placeholder: "Enter UUID..."
        })
      );
      expect(html).toContain("Session ID");
      expect(html).toContain("Invalid session UUID format");
      expect(html).toContain('aria-invalid="true"');
    });

    it("renders Textarea with label and helper text", () => {
      const html = renderToStaticMarkup(
        React.createElement(Textarea, {
          label: "Audit Notes",
          helperText: "Up to 500 characters",
          rows: 4
        })
      );
      expect(html).toContain("Audit Notes");
      expect(html).toContain("Up to 500 characters");
      expect(html).toContain('rows="4"');
    });

    it("renders Select with options array and label", () => {
      const html = renderToStaticMarkup(
        React.createElement(Select, {
          label: "Severity",
          options: [
            { label: "High", value: "high" },
            { label: "Low", value: "low" }
          ]
        })
      );
      expect(html).toContain("Severity");
      expect(html).toContain("High");
      expect(html).toContain("Low");
    });

    it("renders Checkbox with accessible type and label", () => {
      const html = renderToStaticMarkup(
        React.createElement(Checkbox, {
          label: "Require Cryptographic Signature",
          description: "Rejects unverified receipts"
        })
      );
      expect(html).toContain("Require Cryptographic Signature");
      expect(html).toContain("Rejects unverified receipts");
      expect(html).toContain('type="checkbox"');
    });

    it("renders Switch with role='switch' and aria-checked", () => {
      const html = renderToStaticMarkup(
        React.createElement(Switch, {
          checked: true,
          label: "Enforce Workspace Isolation"
        })
      );
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("Enforce Workspace Isolation");
    });

    it("renders RadioGroup and Radio items with accessibility roles", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RadioGroup,
          {
            name: "environment",
            value: "prod",
            onChange: () => {},
            "aria-label": "Deployment Target"
          },
          React.createElement(Radio, { value: "staging", label: "Staging" }),
          React.createElement(Radio, { value: "prod", label: "Production" })
        )
      );
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('type="radio"');
      expect(html).toContain('aria-label="Deployment Target"');
      expect(html).toContain("Production");
    });
  });

  describe("Cards & Panels", () => {
    it("renders Card and Panel with semantic variants", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Card,
          null,
          React.createElement(
            CardHeader,
            null,
            React.createElement(CardTitle, null, "Incident TRV-104"),
            React.createElement(CardDescription, null, "Workspace WS-01")
          ),
          React.createElement(CardContent, null, "Body Content"),
          React.createElement(CardFooter, null, "Footer Content")
        )
      );
      expect(html).toContain("Incident TRV-104");
      expect(html).toContain("Workspace WS-01");
      expect(html).toContain("Body Content");
      expect(html).toContain("Footer Content");

      const panelHtml = renderToStaticMarkup(
        React.createElement(
          Panel,
          { variant: "danger", title: "Security Warning" },
          "Tampered receipt detected"
        )
      );
      expect(panelHtml).toContain("Security Warning");
      expect(panelHtml).toContain("Tampered receipt detected");
    });
  });

  describe("Badges & Status Indicators", () => {
    it("renders Badge variants and StatusIndicator states", () => {
      const dotHtml = renderToStaticMarkup(
        React.createElement(StatusDot, { status: "success", pulse: true })
      );
      expect(dotHtml).toContain("bg-emerald-500");

      const badgeHtml = renderToStaticMarkup(
        React.createElement(Badge, { variant: "purple" }, "AgentLedger")
      );
      expect(badgeHtml).toContain("AgentLedger");
      expect(badgeHtml).toContain("text-purple-400");

      const statusHtml = renderToStaticMarkup(
        React.createElement(StatusIndicator, { status: "verified" })
      );
      expect(statusHtml).toContain("VERIFIED");
      expect(statusHtml).toContain("text-emerald-400");

      const tamperedHtml = renderToStaticMarkup(
        React.createElement(StatusIndicator, { status: "tampered" })
      );
      expect(tamperedHtml).toContain("TAMPERED");
      expect(tamperedHtml).toContain("text-rose-400");
    });
  });

  describe("Dialogs & ConfirmDialog", () => {
    it("renders Dialog structure with dialog role and aria-modal", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Dialog,
          { open: true, onOpenChange: () => {} },
          React.createElement(
            DialogHeader,
            null,
            React.createElement(DialogTitle, null, "Revoke Session"),
            React.createElement(DialogDescription, null, "This cannot be undone.")
          ),
          React.createElement(DialogContent, null, "Are you sure?"),
          React.createElement(DialogFooter, null, React.createElement(Button, null, "Confirm"))
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain("Revoke Session");
      expect(html).toContain("This cannot be undone.");
    });

    it("renders ConfirmDialog with danger variant", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConfirmDialog, {
          open: true,
          onOpenChange: () => {},
          onConfirm: () => {},
          title: "Delete Evidence Store",
          description: "All records will be purged.",
          variant: "danger",
          confirmLabel: "Delete"
        })
      );
      expect(html).toContain("Delete Evidence Store");
      expect(html).toContain("All records will be purged.");
      expect(html).toContain("Delete");
    });
  });

  describe("Dropdowns & Tooltips", () => {
    it("renders Dropdown trigger and container", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          DropdownMenu,
          null,
          React.createElement(DropdownTrigger, null, "Actions"),
          React.createElement(
            DropdownContent,
            null,
            React.createElement(DropdownHeader, null, "Manage"),
            React.createElement(DropdownItem, null, "Export Receipt"),
            React.createElement(DropdownSeparator, null),
            React.createElement(DropdownItem, { variant: "destructive" }, "Purge")
          )
        )
      );
      expect(html).toContain("Actions");
      expect(html).toContain('aria-haspopup="menu"');
    });

    it("renders Tooltip with children trigger", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Tooltip,
          { content: "Ed25519 signature verified offline" },
          React.createElement("button", null, "Hover Me")
        )
      );
      expect(html).toContain("Hover Me");
    });
  });

  describe("Tabs", () => {
    it("renders Tabs with tablist and active tab content", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Tabs,
          { defaultValue: "evidence" },
          React.createElement(
            TabsList,
            null,
            React.createElement(TabsTrigger, { value: "evidence" }, "Evidence Records"),
            React.createElement(TabsTrigger, { value: "graph" }, "Dependency Graph")
          ),
          React.createElement(TabsContent, { value: "evidence" }, "Evidence Table Content"),
          React.createElement(TabsContent, { value: "graph" }, "Graph Canvas Content")
        )
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('role="tabpanel"');
      expect(html).toContain("Evidence Records");
      expect(html).toContain("Evidence Table Content");
      // inactive content is not rendered
      expect(html).not.toContain("Graph Canvas Content");
    });
  });

  describe("Tables", () => {
    it("renders structured Table with header, body, and rows", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Table,
          null,
          React.createElement(
            TableHeader,
            null,
            React.createElement(
              TableRow,
              null,
              React.createElement(TableHead, null, "Timestamp"),
              React.createElement(TableHead, null, "Action"),
              React.createElement(TableHead, null, "Status")
            )
          ),
          React.createElement(
            TableBody,
            null,
            React.createElement(
              TableRow,
              null,
              React.createElement(TableCell, null, "2026-11-11T12:00:00Z"),
              React.createElement(TableCell, null, "FILE_WRITE"),
              React.createElement(TableCell, null, "ALLOWED")
            )
          )
        )
      );
      expect(html).toContain("Timestamp");
      expect(html).toContain("FILE_WRITE");
      expect(html).toContain("ALLOWED");
    });
  });

  describe("Feedback States: Spinner, Loading, Empty, Error, Alert", () => {
    it("renders Spinner and LoadingState", () => {
      const spinnerHtml = renderToStaticMarkup(React.createElement(Spinner, { size: "lg" }));
      expect(spinnerHtml).toContain('role="status"');
      expect(spinnerHtml).toContain("animate-spin");

      const loadingHtml = renderToStaticMarkup(
        React.createElement(LoadingState, { message: "Verifying Merkle Tree..." })
      );
      expect(loadingHtml).toContain("Verifying Merkle Tree...");
    });

    it("renders EmptyState and ErrorState", () => {
      const emptyHtml = renderToStaticMarkup(
        React.createElement(EmptyState, {
          title: "No Evidence Found",
          description: "Submit events to populate this investigation timeline."
        })
      );
      expect(emptyHtml).toContain("No Evidence Found");
      expect(emptyHtml).toContain("Submit events to populate this investigation timeline.");

      const errorHtml = renderToStaticMarkup(
        React.createElement(ErrorState, {
          title: "Receipt Verification Failed",
          error: "Public key mismatch against signature header"
        })
      );
      expect(errorHtml).toContain("Receipt Verification Failed");
      expect(errorHtml).toContain("Public key mismatch against signature header");
    });

    it("renders Alert with variants and accessible role='alert'", () => {
      const alertHtml = renderToStaticMarkup(
        React.createElement(
          Alert,
          { variant: "warning", title: "Untrusted Key Warning" },
          "The signature key is not registered in the trusted workspace keystore."
        )
      );
      expect(alertHtml).toContain('role="alert"');
      expect(alertHtml).toContain("Untrusted Key Warning");
      expect(alertHtml).toContain("The signature key is not registered");
    });
  });

  describe("Navigation Primitives: Breadcrumbs & NavPill", () => {
    it("renders Breadcrumbs with accessible current page", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Breadcrumbs,
          null,
          React.createElement(BreadcrumbItem, { href: "/incidents" }, "Incidents"),
          React.createElement(BreadcrumbItem, { isCurrentPage: true }, "INC-4029")
        )
      );
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("INC-4029");
    });

    it("renders NavPill with active and badge state", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          NavPill,
          { active: true, variant: "blue", badge: "12" },
          "Active Incidents"
        )
      );
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain("Active Incidents");
      expect(html).toContain("12");
    });
  });
});
