export type CatalogField = "guid" | "text" | "date" | "long" | "int" | "number" | "boolean" | "masked";

export interface CatalogResource {
  resource: string;
  label: string;
  fields: Record<string, CatalogField>;
  filters: readonly string[];
  key: string | null;
}

export interface MutationFields {
  fields: Record<string, Exclude<CatalogField, "masked"> | "binary">;
  required: readonly string[];
}

export interface CatalogMutation extends MutationFields {
  entity: string;
  method: "POST" | "PUT";
  children?: Record<string, MutationFields>;
}
