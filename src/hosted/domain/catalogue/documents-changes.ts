// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const documentsChanges = {
  exact_documents_create: { entity: "documents", method: "POST",
    fields: {
      ID: "guid", Account: "guid", ActionRegenerateEntryProposal: "boolean", AmountFC: "number", Body: "text",
      Category: "guid", CategoryDescription: "text", Contact: "guid", ContractID: "guid", CostcenterCode: "text",
      CostunitCode: "text", Currency: "text", DocumentDate: "date", DocumentFolder: "guid", ExpiryDate: "date",
      FinancialTransactionEntryID: "guid", HID: "int", InheritShare: "boolean", InvoiceNotes: "text", Item: "guid",
      Language: "text", MarkAsPaid: "boolean", Opportunity: "guid", Project: "guid", ProposedEntryStatus: "int",
      SalesInvoiceNumber: "int", SalesOrderNumber: "int", ShopOrderNumber: "int", Subject: "text", TeamsMeetingId:
      "text", Type: "int" },
    required: ["Subject", "Type"],
  },
  exact_documents_update: { entity: "documents", method: "PUT",
    fields: {
      Account: "guid", ActionRegenerateEntryProposal: "boolean", AmountFC: "number", Body: "text", Category: "guid",
      CategoryDescription: "text", Contact: "guid", ContractID: "guid", CostcenterCode: "text", CostunitCode:
      "text", Currency: "text", DocumentDate: "date", DocumentFolder: "guid", ExpiryDate: "date",
      FinancialTransactionEntryID: "guid", HID: "int", InheritShare: "boolean", InvoiceNotes: "text", Item: "guid",
      Language: "text", MarkAsPaid: "boolean", Opportunity: "guid", Project: "guid", ProposedEntryStatus: "int",
      SalesInvoiceNumber: "int", SalesOrderNumber: "int", ShopOrderNumber: "int", Subject: "text", TeamsMeetingId:
      "text", Type: "int" },
    required: [],
  },
  exact_document_attachments_create: { entity: "document_attachments", method: "POST",
    fields: {
      ID: "guid", Attachment: "binary", Document: "guid", FileName: "text" },
    required: ["Attachment", "Document", "FileName"],
  },
} satisfies Record<string, CatalogMutation>;
