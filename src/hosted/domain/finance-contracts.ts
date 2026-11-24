import { z } from "zod";
import { amount, currency, cursor, date, division, guid, label, page } from "./read-fields.js";

const year = z.number().int().min(1900).max(9999);
const period = z.number().int().min(0).max(366);
const code = z.string().trim().min(1).max(40);
const integer = z.number().int();
const recordNumber = integer.positive().max(2_147_483_647);
const description = z.string().max(500).nullable();
const dates = { fromDate: date.optional(), toDate: date.optional() };
const dueDates = { dueFrom: date.optional(), dueThrough: date.optional() };
const ordered = ({ fromDate, toDate }: { fromDate?: string; toDate?: string }) =>
  !fromDate || !toDate || fromDate <= toDate;
const dateOrderMessage = "Give a fromDate on or before toDate.";
const dueDatesOrdered = ({ dueFrom, dueThrough }: { dueFrom?: string; dueThrough?: string }) =>
  !dueFrom || !dueThrough || dueFrom <= dueThrough;
const dueOrderMessage = "Give a dueFrom on or before dueThrough.";
const pageHelp = "Use the same filters and nextCursor as cursor for more. A page is not a financial total.";
const supplierId = guid.optional();
const status = z.enum(["open", "processed"]);
const journalCode = code.optional();
const glAccountCode = code.optional();

export const assetStatuses = { active: 1, unvalidated: 2, inactive: 3, depreciated: 4, blocked: 5, sold: 6 } as const;
export const paymentStatuses = { open: 20, selected: 30, processed: 40, matched: 50 } as const;
const assetStatus = z.enum(Object.keys(assetStatuses) as (keyof typeof assetStatuses)[]);
const paymentStatus = z.enum(Object.keys(paymentStatuses) as (keyof typeof paymentStatuses)[]);

export const financeInputs = {
  transaction_lines: z.strictObject({ division, cursor, ...dates,
    year: year.optional(), period: period.optional(), entryId: guid.optional(), invoiceNumber: recordNumber.optional(),
    journalCode, glAccountCode, accountId: guid.optional(), status: status.optional() })
    .refine(ordered, dateOrderMessage)
    .refine((input) => (input.year === undefined) === (input.period === undefined), "Give both year and period.")
    .refine((input) => Boolean(input.entryId || input.invoiceNumber || input.fromDate || input.toDate || input.year ||
      input.journalCode || input.glAccountCode || input.accountId), "Give an entry, invoice, date, period, journal, or account."),
  supplier_search: z.strictObject({ division, cursor, name: z.string().trim().min(2).max(80).optional(), code: code.optional() }),
  supplier_bank_info: z.strictObject({ division, cursor, supplierId: guid }),
  assets: z.strictObject({ division, cursor, code: code.optional(), groupCode: code.optional(), status: assetStatus.optional() }),
  open_payables: z.strictObject({ division, cursor, supplierId, ...dueDates }).refine(dueDatesOrdered, dueOrderMessage),
  payment_status: z.strictObject({ division, cursor, supplierId, ...dueDates,
    invoiceNumber: recordNumber.optional(), batchNumber: recordNumber.optional(), status: paymentStatus.optional() })
    .refine(dueDatesOrdered, dueOrderMessage),
  bank_entries: z.strictObject({ division, cursor, year, period, journalCode, status: status.optional() }),
  purchase_entries: z.strictObject({ division, cursor, supplierId, ...dates, invoiceNumber: recordNumber.optional(), entryNumber: recordNumber.optional(),
    supplierReference: z.string().trim().min(1).max(100).optional(), status: z.enum(["rejected", "open", "processed"]).optional() })
    .refine(ordered, dateOrderMessage),
  invoice_lines: z.strictObject({ division, cursor, kind: z.enum(["sales", "purchase"]), invoiceId: guid }),
  reporting_balances: z.strictObject({ division, cursor, year, period: period.optional(), glAccountCode, status: status.optional() }),
  journal_status: z.strictObject({ division, cursor, year, period, journalCode }),
  gl_accounts: z.strictObject({ division, cursor, code: code.optional(),
    description: z.string().trim().min(2).max(80).optional(), type: z.enum(["bank", "cash", "receivable", "payable"]).optional() }),
} as const;

const identifier = z.string().regex(/^\d+$/);
const nullableLabel = label.nullable();
const nullableAmount = amount.nullable();
const nullableDate = date.nullable();
const nullableInteger = integer.nullable();

export const financeRows = {
  transaction_lines: z.strictObject({ id: guid, entryId: guid, entryNumber: integer,
    lineNumber: integer, date, year, period, journalCode: label.nullable(), glAccountCode: label.nullable(),
    glAccount: label.nullable(), description, accountId: guid.nullable(), account: label.nullable(),
    invoiceNumber: integer.nullable(), type: integer, status: integer,
    amountCompanyCurrency: amount, amountTransactionCurrency: amount, transactionCurrency: currency,
    costCentre: label.nullable(), costUnit: label.nullable() }),
  supplier_search: z.strictObject({ id: guid, code: label, name: label, blocked: z.boolean().nullable(),
    paymentTerms: nullableLabel }),
  supplier_bank_info: z.strictObject({ id: guid, supplierId: guid, supplier: nullableLabel, accountHolder: nullableLabel,
    accountLastFour: z.string().regex(/^[A-Z0-9]{4}$/).nullable(), bic: nullableLabel,
    main: z.boolean().nullable(), blocked: z.boolean().nullable() }),
  assets: z.strictObject({ id: guid, code: label, description, groupCode: nullableLabel, depreciationMethod: nullableLabel,
    investmentDate: nullableDate, depreciationStartDate: nullableDate, endDate: nullableDate, status: integer,
    investmentCompanyCurrency: nullableAmount, investmentAmount: nullableAmount, investmentCurrency: currency.nullable(),
    residualValue: nullableAmount }),
  open_payables: z.strictObject({ id: identifier, supplierId: guid, supplierCode: nullableLabel, supplier: nullableLabel,
    invoiceEntryNumber: nullableInteger, supplierReference: nullableLabel, invoiceDate: nullableDate, dueDate: nullableDate,
    currency, openAmount: amount, amountInTransit: nullableAmount, approvalStatus: nullableInteger }),
  payment_status: z.strictObject({ id: guid, supplierId: guid.nullable(), supplierCode: nullableLabel, supplier: nullableLabel,
    invoiceNumber: nullableInteger, purchaseLineId: guid.nullable(), amountCompanyCurrency: amount, amount: amount, currency,
    dueDate: nullableDate, proposedDate: nullableDate, processingDate: nullableDate, batchNumber: nullableInteger,
    status: integer, statusLabel: z.enum(["open", "selected", "processed", "matched", "other"]),
    paymentMethod: nullableLabel, reference: nullableLabel, supplierBankAccountId: guid.nullable() }),
  bank_entries: z.strictObject({ entryId: guid, entryNumber: integer, year, period, journalCode: label, journal: nullableLabel,
    currency, openingBalance: amount, closingBalance: amount, status: integer }),
  purchase_entries: z.strictObject({ entryId: guid, entryNumber: integer, invoiceNumber: nullableInteger, description,
    supplierId: guid.nullable(), supplier: nullableLabel, supplierReference: nullableLabel, journalCode: nullableLabel,
    invoiceDate: nullableDate, dueDate: nullableDate, currency, amount: amount, amountCompanyCurrency: amount,
    vatAmount: nullableAmount, status: integer, type: integer }),
  invoice_lines: z.strictObject({ id: guid, invoiceId: guid, lineNumber: integer, description, quantity: nullableAmount,
    itemCode: nullableLabel, glAccountCode: nullableLabel, invoiceCurrency: currency,
    amount: amount, amountCompanyCurrency: amount, vatAmount: nullableAmount }),
  reporting_balances: z.strictObject({ id: identifier, year, period, glAccountCode: label, glAccount: nullableLabel,
    balanceType: nullableLabel, costCentre: nullableLabel, costUnit: nullableLabel, type: integer, status: integer,
    amount: amount, debit: amount, credit: amount, lineCount: integer.nonnegative() }),
  journal_status: z.strictObject({ year, period, journalCode: label, journal: nullableLabel, journalType: integer,
    status: integer, statusLabel: nullableLabel }),
  gl_accounts: z.strictObject({ id: guid, code: label, description, type: integer, typeLabel: nullableLabel,
    balanceType: nullableLabel, blocked: z.boolean().nullable() }),
} as const;

export const financeOutputs = {
  transaction_lines: page(financeRows.transaction_lines),
  supplier_search: page(financeRows.supplier_search),
  supplier_bank_info: page(financeRows.supplier_bank_info),
  assets: page(financeRows.assets),
  open_payables: page(financeRows.open_payables),
  payment_status: page(financeRows.payment_status),
  bank_entries: page(financeRows.bank_entries),
  purchase_entries: page(financeRows.purchase_entries),
  invoice_lines: page(financeRows.invoice_lines),
  reporting_balances: page(financeRows.reporting_balances),
  journal_status: page(financeRows.journal_status),
  gl_accounts: page(financeRows.gl_accounts),
} as const;

export const financeDescriptions = {
  transaction_lines: "Read individual ledger lines. Give an entry ID, invoice number, date range, year and period, journal or account. " +
    "Company amounts follow Exact's debit-positive convention. " + pageHelp,
  supplier_search: "Find suppliers by partial name or code. Returns the supplier ID, blocked flag and purchase payment terms. " + pageHelp,
  supplier_bank_info: "Read the holder, masked number, BIC and main or blocked flags for one supplier's registered bank accounts. " +
    "Get the supplierId from supplier_search. Use Exact directly to confirm payment instructions. " + pageHelp,
  assets: "List fixed assets with investment values, status and depreciation start dates. Filter by code, group or status. " +
    "The register omits Exact's calculated accumulated depreciation and last depreciation date. " + pageHelp,
  open_payables: "List current open supplier obligations with due dates, approval codes and amounts in transit. " +
    "Filter by supplier ID or due date. invoiceEntryNumber is the Exact purchase entry number. Keep each row's currency. " + pageHelp,
  payment_status: "Track Exact payment records by supplier, invoice, due date, batch or status. " +
    "Open, selected, processed and matched are Exact statuses. Processed does not itself prove settlement at the bank. " + pageHelp,
  bank_entries: "Read opening and closing balances of bank or payment service statement entries in Exact. " +
    "Give the financial year and period, optionally the journal code. Get entry movements with transaction_lines and entryId. " + pageHelp,
  purchase_entries: "Read supplier invoice and credit note headers entered in Exact. Filter by supplier, invoice number, entry number, " +
    "supplier reference, invoice date or status. Use entryId with invoice_lines for the booking details. " + pageHelp,
  invoice_lines: "Read line amounts and VAT for one sales invoice or purchase entry. For sales, use the ID from invoice_lookup. " +
    "For purchase, use the entryId from purchase_entries. Amount and VAT use invoiceCurrency. amountCompanyCurrency uses the company's currency. " + pageHelp,
  reporting_balances: "Read Exact reporting balance rows by reporting year and optional period, ledger account code or status. " +
    "Amounts are in company currency and grouped by account, period, cost dimensions, type and status. " + pageHelp,
  journal_status: "Check whether journals are open or closed for a financial year and period. Supply a journal code to narrow the list. " + pageHelp,
  gl_accounts: "Find general ledger account codes by code, description or type. Use the code to filter ledger lines and reporting balances. " + pageHelp,
};
