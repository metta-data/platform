// ============================================
// CSDM (Common Service Data Model) Reference Data
// ============================================
//
// The CSDM is ServiceNow's standard framework for organizing
// service-related data across the platform lifecycle.
//
// Table mappings will be provided by the user from official
// ServiceNow CSDM reference images. Placeholder entries are
// populated from the Ideation & Strategy and Foundation domains.
// Other domains have skeleton structures ready to fill in.

// ----- Types -----

export interface CsdmTable {
  /** ServiceNow table technical name (e.g. "sn_align_core_product_idea") */
  name: string;
  /** Human-readable label (e.g. "Product Idea") */
  label: string;
}

export interface CsdmDomain {
  /** URL-safe slug (e.g. "ideation-strategy") */
  id: string;
  /** Display name (e.g. "Ideation & Strategy") */
  label: string;
  /** Short description of this lifecycle phase */
  description: string;
  /** Tables belonging to this domain */
  tables: CsdmTable[];
}

export interface CsdmLifecycle {
  /** Slug identifier */
  id: string;
  /** Container label (e.g. "Manage Portfolio") */
  label: string;
  /** The ordered lifecycle domains (left-to-right chevrons) */
  domains: CsdmDomain[];
}

// ----- Data -----

/**
 * The five lifecycle phases rendered as chevrons.
 * Tables populated from ServiceNow CSDM reference images.
 */
export const CSDM_LIFECYCLE: CsdmLifecycle = {
  id: "manage-portfolio",
  label: "Manage Portfolio",
  domains: [
    {
      id: "ideation-strategy",
      label: "Ideation & Strategy",
      description:
        "Define strategic goals, priorities, and product ideas that drive the service portfolio.",
      tables: [
        { name: "sn_align_core_product_idea", label: "Product Idea" },
        { name: "sn_align_core_planning_item", label: "Planning Item" },
        { name: "sn_gf_plan", label: "Strategic Plan" },
        { name: "sn_gf_strategy", label: "Strategic Priority" },
        { name: "sn_gf_goal", label: "Goal" },
        { name: "sn_gf_target", label: "Target" },
      ],
    },
    {
      id: "design-planning",
      label: "Design & Planning",
      description:
        "Architect services and plan implementations for the portfolio.",
      tables: [
        // TODO: User to provide tables from CSDM reference image
      ],
    },
    {
      id: "build-integration",
      label: "Build & Integration",
      description:
        "Build, configure, test, and deploy services and their components.",
      tables: [
        // TODO: User to provide tables from CSDM reference image
      ],
    },
    {
      id: "service-delivery",
      label: "Service Delivery",
      description:
        "Deliver and operate services for the organization.",
      tables: [
        // TODO: User to provide tables from CSDM reference image
      ],
    },
    {
      id: "service-consumption",
      label: "Service Consumption",
      description:
        "End-user consumption, requests, and experience with services.",
      tables: [
        // TODO: User to provide tables from CSDM reference image
      ],
    },
  ],
};

/**
 * Foundation tables that span across all lifecycle phases.
 * Rendered as a separate row at the bottom of the CSDM view.
 */
export const CSDM_FOUNDATION: CsdmDomain = {
  id: "foundation",
  label: "Foundation",
  description:
    "Cross-cutting foundational data shared across all lifecycle phases, including value streams, business processes, and product models.",
  tables: [
    { name: "cmn_value_stream", label: "Value Stream" },
    { name: "cmn_value_stream_stage", label: "Value Stream Stage" },
    { name: "cmdb_ci_business_process", label: "Business Process" },
    { name: "cmdb_model", label: "Product Model" },
  ],
};

/**
 * All CSDM domains (lifecycle + foundation) for lookups.
 */
export const ALL_CSDM_DOMAINS: CsdmDomain[] = [
  ...CSDM_LIFECYCLE.domains,
  CSDM_FOUNDATION,
];
