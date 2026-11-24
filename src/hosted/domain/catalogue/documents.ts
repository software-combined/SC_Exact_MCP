// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const documents = {
  documents: { resource: "documents/Documents", label: "documents: contracts, scans and other files filed in Exact",
    fields: {
      ID: "guid", Subject: "text", Type: "int", TypeDescription: "text", Category: "guid", CategoryDescription:
      "text", Account: "guid", AccountName: "text", Contact: "guid", DocumentDate: "date", DocumentFolder: "guid",
      HasEmptyBody: "boolean", FinancialTransactionEntryID: "guid", Created: "date", Modified: "date" },
    filters: [
      "ID", "Subject", "Type", "TypeDescription", "Category", "CategoryDescription", "Account", "AccountName",
      "Contact", "DocumentDate", "DocumentFolder", "HasEmptyBody", "FinancialTransactionEntryID", "Created",
      "Modified" ],
    key: "ID" },
  document_attachments: { resource: "documents/DocumentAttachments", label: "the files attached to a document",
    fields: {
      ID: "guid", Document: "guid", FileName: "text", FileSize: "number" },
    filters: [
      "ID", "Document", "FileName", "FileSize" ],
    key: "ID" },
  document_categories: { resource: "documents/DocumentCategories", label: "document categories",
    fields: {
      ID: "guid", Description: "text", Created: "date", Modified: "date" },
    filters: [
      "ID", "Description", "Created", "Modified" ],
    key: "ID" },
  document_types: { resource: "documents/DocumentTypes", label: "document types and the category each belongs to",
    fields: {
      ID: "int", Description: "text", DocumentIsCreatable: "boolean", DocumentIsViewable: "boolean",
      DocumentIsUpdatable: "boolean", DocumentIsDeletable: "boolean", TypeCategory: "int", Modified: "date" },
    filters: [
      "ID", "Description", "DocumentIsCreatable", "DocumentIsViewable", "DocumentIsUpdatable",
      "DocumentIsDeletable", "TypeCategory", "Modified" ],
    key: "ID" },
  document_folders: { resource: "documents/DocumentFolders", label: "the folder tree documents are filed in",
    fields: {
      ID: "guid", Description: "text", ParentFolder: "guid", Created: "date", Modified: "date" },
    filters: [
      "ID", "Description", "ParentFolder", "Created", "Modified" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
