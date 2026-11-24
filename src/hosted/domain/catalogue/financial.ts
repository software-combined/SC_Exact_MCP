// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const financial = {
  gl_accounts: { resource: "financial/GLAccounts", label: "the chart of accounts (general ledger accounts)",
    fields: {
      ID: "guid", Code: "text", Description: "text", BalanceSide: "text", BalanceType: "text", Type: "int",
      TypeDescription: "text", Costcenter: "text", Compress: "boolean", IsBlocked: "boolean", VATCode: "text",
      VATDescription: "text", Created: "date", Modified: "date" },
    filters: [
      "ID", "Code", "Description", "BalanceSide", "BalanceType", "Type", "TypeDescription", "Costcenter",
      "Compress", "IsBlocked", "VATCode", "VATDescription", "Created", "Modified" ],
    key: "ID" },
  gl_classifications: { resource: "financial/GLClassifications", label: "statutory classifications ledger accounts map onto",
    fields: {
      ID: "guid", Code: "text", Name: "text", Description: "text", Parent: "guid", TaxonomyNamespace: "guid",
      TaxonomyNamespaceDescription: "text", Type: "guid", Modified: "date" },
    filters: [
      "ID", "Code", "Name", "Description", "Parent", "TaxonomyNamespace", "TaxonomyNamespaceDescription", "Type",
      "Modified" ],
    key: "ID" },
  gl_classification_mappings: { resource: "financial/GLAccountClassificationMappings", label: "the mapping between ledger accounts and statutory classifications",
    fields: {
      ID: "guid", GLAccount: "guid", GLAccountCode: "text", Classification: "guid", ClassificationCode: "text",
      ClassificationDescription: "text" },
    filters: [
      "ID", "GLAccount", "GLAccountCode", "Classification", "ClassificationCode", "ClassificationDescription" ],
    key: "ID" },
  journals: { resource: "financial/Journals", label: "journals (day books): sales, purchase, bank, cash and general",
    fields: {
      ID: "guid", Code: "text", Description: "text", Type: "int", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", GLAccountType: "int", Currency: "text", Bank: "guid", BankAccountDescription:
      "text", PaymentServiceProviderName: "text", AllowVAT: "boolean", IsBlocked: "boolean", Modified: "date",
      BankAccountIBAN: "masked" },
    filters: [
      "ID", "Code", "Description", "Type", "GLAccount", "GLAccountCode", "GLAccountDescription", "GLAccountType",
      "Currency", "Bank", "BankAccountDescription", "PaymentServiceProviderName", "AllowVAT", "IsBlocked",
      "Modified" ],
    key: "ID" },
  financial_periods: { resource: "financial/FinancialPeriods", label: "bookkeeping periods and whether they are open or closed",
    fields: {
      ID: "guid", FinYear: "int", FinPeriod: "int", StartDate: "date", EndDate: "date", Created: "date", Modified:
      "date" },
    filters: [
      "ID", "FinYear", "FinPeriod", "StartDate", "EndDate", "Created", "Modified" ],
    key: "ID" },
  transaction_lines: { resource: "financialtransaction/TransactionLines", label: "every booking line in the ledger, whatever document created it",
    fields: {
      ID: "guid", EntryID: "guid", EntryNumber: "int", Date: "date", FinancialYear: "int", FinancialPeriod: "int",
      JournalCode: "text", JournalDescription: "text", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", Description: "text", AmountDC: "number", AmountFC: "number", Currency: "text", AmountVATFC:
      "number", AmountVATBaseFC: "number", Account: "guid", AccountName: "text", Type: "int", Status: "int",
      InvoiceNumber: "int", YourRef: "text", DueDate: "date", CostCenter: "text", CostUnit: "text", Project: "guid",
      Document: "guid", Modified: "date" },
    filters: [
      "ID", "EntryID", "EntryNumber", "Date", "FinancialYear", "FinancialPeriod", "JournalCode", "GLAccount",
      "GLAccountCode", "Description", "Account", "Status", "InvoiceNumber", "YourRef", "CostCenter", "CostUnit",
      "Project", "Document", "Modified" ],
    key: "ID" },
  reporting_balance: { resource: "financial/ReportingBalance", label: "the trial balance per ledger account, year and period",
    fields: {
      ID: "long", ReportingYear: "int", ReportingPeriod: "int", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", BalanceType: "text", Amount: "number", AmountCredit: "number", AmountDebit:
      "number", Count: "int", Type: "int", Status: "int", CostCenterCode: "text", CostUnitCode: "text" },
    filters: [
      "ReportingYear", "ReportingPeriod", "GLAccount", "GLAccountCode", "GLAccountDescription", "BalanceType",
      "Amount", "AmountCredit", "AmountDebit", "Count", "Type", "Status", "CostCenterCode", "CostUnitCode" ],
    key: null },
  general_journal_entries: { resource: "generaljournalentry/GeneralJournalEntries", label: "manual journal entries (memorial bookings)",
    fields: {
      EntryID: "guid", EntryNumber: "int", JournalCode: "text", JournalDescription: "text", FinancialPeriod: "int",
      FinancialYear: "int", Currency: "text", Type: "int", TypeDescription: "text", Status: "int",
      StatusDescription: "text", Reversal: "boolean", Created: "date", Modified: "date" },
    filters: [
      "EntryID", "EntryNumber", "JournalCode", "JournalDescription", "FinancialPeriod", "FinancialYear", "Currency",
      "Type", "TypeDescription", "Status", "StatusDescription", "Reversal", "Created", "Modified" ],
    key: "EntryID" },
  general_journal_entry_lines: { resource: "generaljournalentry/GeneralJournalEntryLines", label: "lines of manual journal entries",
    fields: {
      ID: "guid", EntryID: "guid", LineNumber: "int", Date: "date", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", Description: "text", AmountDC: "number", AmountFC: "number", VATCode: "text",
      CostCenter: "text", CostUnit: "text", Project: "guid", Modified: "date" },
    filters: [
      "ID", "EntryID", "LineNumber", "Date", "GLAccount", "GLAccountCode", "GLAccountDescription", "Description",
      "AmountDC", "AmountFC", "VATCode", "CostCenter", "CostUnit", "Project", "Modified" ],
    key: "ID" },
  exchange_rates: { resource: "financial/ExchangeRates", label: "currency exchange rates",
    fields: {
      ID: "guid", SourceCurrency: "text", TargetCurrency: "text", Rate: "number", StartDate: "date", Created:
      "date", Modified: "date" },
    filters: [
      "ID", "SourceCurrency", "TargetCurrency", "Rate", "StartDate", "Created", "Modified" ],
    key: "ID" },
  currencies: { resource: "general/Currencies", label: "currencies configured in the administration",
    fields: {
      Code: "text", Description: "text", AmountPrecision: "number", PricePrecision: "number", Modified: "date" },
    filters: [
      "Code", "Description", "AmountPrecision", "PricePrecision", "Modified" ],
    key: "Code" },
} satisfies Record<string, CatalogResource>;
