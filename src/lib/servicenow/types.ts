export interface ServiceNowCredentials {
  url: string;
  username: string;
  password: string;
}

export interface SysDbObjectRecord {
  sys_id: string;
  name: string;
  label: string;
  super_class: { display_value: string; value: string } | string;
  sys_scope: { display_value: string; value: string } | string;
  is_extendable: string;
  accessible_from: string;
  number_ref: { display_value: string; value: string } | string;
}

export interface SysDictionaryRecord {
  sys_id: string;
  name: string;
  element: string;
  column_label: string;
  internal_type: { display_value: string; value: string } | string;
  max_length: string;
  mandatory: string;
  read_only: string;
  active: string;
  reference: { display_value: string; value: string } | string;
  default_value: string;
  display: string;
  primary: string;
}

export interface ServiceNowApiResponse<T> {
  result: T[];
}

export interface IngestProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}
