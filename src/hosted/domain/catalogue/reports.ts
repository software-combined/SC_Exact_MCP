// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const reports = {
  receivables: { resource: "read/financial/ReceivablesList", label: "outstanding customer invoices (accounts receivable)",
    fields: {
      HID: "long", AccountId: "guid", AccountCode: "text", AccountName: "text", InvoiceNumber: "int", YourRef:
      "text", Description: "text", InvoiceDate: "date", DueDate: "date", Amount: "number", AmountInTransit:
      "number", CurrencyCode: "text", JournalCode: "text", JournalDescription: "text", EntryNumber: "int" },
    filters: [
      "AccountId", "AccountCode", "AccountName", "InvoiceNumber", "YourRef", "Description", "InvoiceDate",
      "DueDate", "Amount", "AmountInTransit", "CurrencyCode", "JournalCode", "JournalDescription", "EntryNumber" ],
    key: null },
  payables: { resource: "read/financial/PayablesList", label: "outstanding supplier invoices (accounts payable)",
    fields: {
      HID: "long", AccountId: "guid", AccountCode: "text", AccountName: "text", InvoiceNumber: "int", YourRef:
      "text", Description: "text", InvoiceDate: "date", DueDate: "date", Amount: "number", AmountInTransit:
      "number", CurrencyCode: "text", JournalCode: "text", JournalDescription: "text", EntryNumber: "int",
      ApprovalStatus: "int" },
    filters: [
      "AccountId", "AccountCode", "AccountName", "InvoiceNumber", "YourRef", "Description", "InvoiceDate",
      "DueDate", "Amount", "AmountInTransit", "CurrencyCode", "JournalCode", "JournalDescription", "EntryNumber",
      "ApprovalStatus" ],
    key: null },
  aging_receivables: { resource: "read/financial/AgingReceivablesList", label: "receivables bucketed by how overdue they are, per customer",
    fields: {
      AccountId: "guid", AccountCode: "text", AccountName: "text", CurrencyCode: "text", AgeGroup1Amount: "number",
      AgeGroup2Amount: "number", AgeGroup3Amount: "number", AgeGroup4Amount: "number", TotalAmount: "number",
      AgeGroup1Description: "text", AgeGroup2Description: "text", AgeGroup3Description: "text",
      AgeGroup4Description: "text" },
    filters: [
      "AccountId", "AccountCode", "AccountName", "CurrencyCode", "AgeGroup1Amount", "AgeGroup2Amount",
      "AgeGroup3Amount", "AgeGroup4Amount", "TotalAmount", "AgeGroup1Description", "AgeGroup2Description",
      "AgeGroup3Description", "AgeGroup4Description" ],
    key: null },
  aging_payables: { resource: "read/financial/AgingPayablesList", label: "payables bucketed by how overdue they are, per supplier",
    fields: {
      AccountId: "guid", AccountCode: "text", AccountName: "text", CurrencyCode: "text", AgeGroup1Amount: "number",
      AgeGroup2Amount: "number", AgeGroup3Amount: "number", AgeGroup4Amount: "number", TotalAmount: "number" },
    filters: [
      "AccountId", "AccountCode", "AccountName", "CurrencyCode", "AgeGroup1Amount", "AgeGroup2Amount",
      "AgeGroup3Amount", "AgeGroup4Amount", "TotalAmount" ],
    key: null },
  aging_overview: { resource: "read/financial/AgingOverview", label: "the totals of the receivables and payables aging buckets",
    fields: {
      AgeGroup: "int", AgeGroupDescription: "text", AmountPayable: "number", AmountReceivable: "number",
      CurrencyCode: "text" },
    filters: [
      "AgeGroup", "AgeGroupDescription", "AmountPayable", "AmountReceivable", "CurrencyCode" ],
    key: null },
  outstanding_invoices_overview: { resource: "read/financial/OutstandingInvoicesOverview", label: "totals of outstanding sales and purchase invoices",
    fields: {
      CurrencyCode: "text", OutstandingPayableInvoiceAmount: "number", OutstandingPayableInvoiceCount: "number",
      OutstandingReceivableInvoiceAmount: "number", OutstandingReceivableInvoiceCount: "number",
      OverduePayableInvoiceAmount: "number", OverduePayableInvoiceCount: "number", OverdueReceivableInvoiceAmount:
      "number", OverdueReceivableInvoiceCount: "number" },
    filters: [
      "CurrencyCode", "OutstandingPayableInvoiceAmount", "OutstandingPayableInvoiceCount",
      "OutstandingReceivableInvoiceAmount", "OutstandingReceivableInvoiceCount", "OverduePayableInvoiceAmount",
      "OverduePayableInvoiceCount", "OverdueReceivableInvoiceAmount", "OverdueReceivableInvoiceCount" ],
    key: null },
  profit_loss_overview: { resource: "read/financial/ProfitLossOverview", label: "revenue, costs and result for the current and previous year",
    fields: {
      CurrentYear: "int", PreviousYear: "int", CurrentPeriod: "int", CurrencyCode: "text", RevenueCurrentYear:
      "number", RevenuePreviousYear: "number", CostsCurrentYear: "number", CostsPreviousYear: "number",
      ResultCurrentYear: "number", ResultPreviousYear: "number", RevenueCurrentPeriod: "number", CostsCurrentPeriod:
      "number", ResultCurrentPeriod: "number" },
    filters: [
      "CurrentYear", "PreviousYear", "CurrentPeriod", "CurrencyCode", "RevenueCurrentYear", "RevenuePreviousYear",
      "CostsCurrentYear", "CostsPreviousYear", "ResultCurrentYear", "ResultPreviousYear", "RevenueCurrentPeriod",
      "CostsCurrentPeriod", "ResultCurrentPeriod" ],
    key: null },
  revenue_list: { resource: "read/financial/RevenueList", label: "revenue per period",
    fields: {
      Year: "int", Period: "int", Amount: "number" },
    filters: [
      "Year", "Period", "Amount" ],
    key: null },
  journal_status: { resource: "read/financial/JournalStatusList", label: "per journal and period: what is entered and what is still open",
    fields: {
      Journal: "text", Period: "int", Year: "int", JournalDescription: "text", JournalType: "int", Status: "int",
      StatusDescription: "text" },
    filters: [
      "Journal", "Period", "Year", "JournalDescription", "JournalType", "Status", "StatusDescription" ],
    key: null },
  vat_returns: { resource: "read/financial/Returns", label: "submitted VAT returns and their status",
    fields: {
      DocumentID: "guid", Amount: "number", Created: "date", Currency: "text", DueDate: "date", Frequency: "text",
      Period: "int", Status: "int", Type: "int", Year: "int" },
    filters: [
      "DocumentID", "Amount", "Created", "Currency", "DueDate", "Frequency", "Period", "Status", "Type", "Year" ],
    key: null },
} satisfies Record<string, CatalogResource>;
