// ============================================
// CSDM (Common Service Data Model) Reference Data
// ============================================
//
// The CSDM is ServiceNow's standard framework for organizing
// service-related data across its seven domains.
//
// Table mappings are sourced from the CSDM 5 White Paper.
// All seven domains are populated: Foundation, Ideation & Strategy,
// Design & Planning, Build & Integration, Service Delivery,
// Service Consumption, and Manage Portfolio.

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
  /** Short description of this domain */
  description: string;
  /** Tables belonging to this domain */
  tables: CsdmTable[];
}

export interface CsdmDomainContainer {
  /** Slug identifier */
  id: string;
  /** Container label (e.g. "Manage Portfolio") */
  label: string;
  /** The ordered CSDM domains (left-to-right chevrons) */
  domains: CsdmDomain[];
}

// ----- Data -----

/**
 * The CSDM domains rendered as chevrons.
 * Tables populated from the CSDM 5 White Paper.
 */
export const CSDM_DOMAINS: CsdmDomainContainer = {
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
        { name: "sn_gf_goal_target", label: "Target" },
      ],
    },
    {
      id: "design-planning",
      label: "Design & Planning",
      description:
        "Architect services and plan implementations using Enterprise Architecture tables for business capabilities, applications, and information objects.",
      tables: [
        { name: "cmdb_ci_business_capability", label: "Business Capability" },
        { name: "cmdb_ci_business_app", label: "Business Application" },
        { name: "cmdb_ci_information_object", label: "Information Object" },
      ],
    },
    {
      id: "build-integration",
      label: "Build & Integration",
      description:
        "Build, configure, test, and integrate digital products including DevOps pipelines and SDLC components.",
      tables: [
        { name: "cmdb_ci_sdlc_component", label: "SDLC Component" },
      ],
    },
    {
      id: "service-delivery",
      label: "Service Delivery",
      description:
        "Deliver and operate the end-to-end service delivery system including infrastructure, service instances, and technology management services.",
      tables: [
        { name: "cmdb_ci_service_auto", label: "Service Instance" },
        { name: "cmdb_ci_service_discovered", label: "Application Service" },
        { name: "cmdb_ci_service_technical", label: "Technology Mgmt Service" },
        { name: "service_offering", label: "Tech Mgmt Service Offering" },
        { name: "cmdb_ci_query_based_service", label: "Dynamic CI Group" },
        { name: "cmdb_ci_api", label: "API" },
        { name: "cmdb_ci_appl", label: "Application" },
        { name: "cmdb_ci_function_ai", label: "AI Function" },
        { name: "cmdb_ci_appl_ai_application", label: "AI Application" },
        { name: "cmdb_ci_data_service_instance", label: "Data Service Instance" },
        { name: "cmdb_ci_connection_service_instance", label: "Connection Service Instance" },
        { name: "cmdb_ci_network_service_instance", label: "Network Service Instance" },
        { name: "cmdb_ci_facility_service_instance", label: "Facility Service Instance" },
        { name: "cmdb_ci_operational_process_service_instance", label: "Operational Process Service Instance" },
      ],
    },
    {
      id: "service-consumption",
      label: "Service Consumption",
      description:
        "Business services consumed by end-users and customers, managed through Service Portfolio Management and Customer Service Management.",
      tables: [
        { name: "cmdb_ci_service_business", label: "Business Service" },
        { name: "service_offering", label: "Business Service Offering" },
        { name: "service_portfolio", label: "Service Portfolio" },
        { name: "sc_catalog", label: "Request Catalog" },
      ],
    },
  ],
};

/**
 * Foundation tables that span across all domains.
 * Rendered as a separate row at the bottom of the CSDM view.
 */
export const CSDM_FOUNDATION: CsdmDomain = {
  id: "foundation",
  label: "Foundation",
  description:
    "Cross-cutting foundational data shared across all domains, including value streams, business processes, product models, contracts, and CMDB groups.",
  tables: [
    { name: "cmn_value_stream", label: "Value Stream" },
    { name: "cmn_value_stream_stage", label: "Value Stream Stage" },
    { name: "cmdb_ci_business_process", label: "Business Process" },
    { name: "ast_contract", label: "Contract" },
    { name: "cmdb_model", label: "Product Model" },
    { name: "cmdb_group", label: "CMDB Group" },
  ],
};

/**
 * All CSDM domains (including Foundation) for lookups.
 */
export const ALL_CSDM_DOMAINS: CsdmDomain[] = [
  ...CSDM_DOMAINS.domains,
  CSDM_FOUNDATION,
];
